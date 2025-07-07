/********************************************************************************
 * FRESH D4Sign - Tela principal (index.js)
 ********************************************************************************/

const AppUIState = Object.freeze({
  NEW: "NEW",
  DRAFT: "DRAFT",
  READY: "READY",
  SIGNING: "SIGNING",
  DONE: "DONE",
  UNKNOWN: "UNKNOWN"
});

class App {
  constructor() {
    this.client = null;
    this.ticket = null;
    this.document = null;
    this.documentLoadFailed = false;
    this.entityManager = null;
    this.storageEntity = null
  }

  /***********************************
   * Inicialização
   ***********************************/
  async initializeClient() {
    try {
      this.client = await app.initialized();
      this.entityManager = await this.client.db.entity({ version: "v1" });
      this.storageEntity = await this.entityManager.get("ticketDocumentMap");
    } catch (error) {
      console.log("Erro ao carregar client:", error);
      await this.notifyError("Erro ao carregar client");
    }
  }

  /***********************************
   * Ações de interface
   ***********************************/
  async openModal(modalName, data = {}) {
    try {
      const modalMap = {
        newDocument: {
          title: "Novo Contrato",
          template: "views/new-document.html"
        },
        draftDocument: {
          title: "Signatários",
          template: "views/draft-document.html"
        },
        trackDocument: {
          title: "Detalhes do Documento",
          template: "views/track-document.html"
        }
      };

      const modal = modalMap[modalName];
      if (!modal) throw new Error(`Modal "${modalName}" não está definido.`);

      await this.client.interface.trigger("showModal", {
        title: modal.title,
        template: modal.template,
        data
      });
    } catch (error) {
      console.log(`Erro ao abrir modal "${modalName}":`, error);
      await this.notifyError(`Erro ao abrir "${modalName}"`);
    }
  }

  /***********************************
   * Carregamento de dados
   ***********************************/
  async loadTicketData() {
    try {
      const data = await this.client.data.get("ticket");
      this.ticket = data.ticket;
    } catch (error) {
      console.log("Erro ao carregar dados do ticket:", error);
      await this.notifyError("Erro ao carregar dados do ticket");
    }
  }

  async loadLinkedDocument() {
    try {
      const dbData = await this.client.db.get(this.documentKey);

      if (!dbData?.document_uuid) {
        this.document = null;
        return;
      }

      const response = await this.client.request.invokeTemplate("getDocumentOnD4sign", {
        context: { document_uuid: dbData.document_uuid }
      });

      const [document] = JSON.parse(response.response);
      this.document = document;

    } catch (error) {
      if (error.status !== 404) {
        this.documentLoadFailed = true;
        await this.notifyError("Ocorreu um problema ao tentar se comunicar com a D4sign");
        await this.notifyError(error.message);
      }
    }
  }

  /***********************************
   * Cancelamento e desvinculação
   ***********************************/
  async cancelDocument() {
    try {
      const data = await this.client.request.invokeTemplate("cancelDocumentOnD4sign", {
        context: { document_uuid: this.document.uuidDoc }
      });

      const [document] = JSON.parse(data.response);
      console.log(document);

      if (document.statusId === 6) {
        await this.notifySuccess(`${document.nameDoc} foi cancelado com sucesso`);
        await this.loadTicketData();
        await this.loadLinkedDocument();
        if (this.shouldUnlinkDocument) {
          await this.destroyDocumentLink();
        }

        this.renderInterface();
      }
    } catch (error) {
      console.log("Erro ao cancelar documento:", error);
      await this.notifyError("Ocorreu uma falha ao tentar cancelar o documento");
    }
  }

  async destroyDocumentLink() {
    if (!this.document) return;

    const deletion = await this.client.db.delete(this.documentKey);

    if (deletion?.Deleted) {
      this.document = null;
      console.log("Vínculo removido do DB com sucesso.");
    } else {
      console.log("Falha ao remover vínculo do DB.");
    }
  }

  /***********************************
   * Renderização de interface
   ***********************************/
  renderInterface() {
    const state = this.documentUIState;

    const loader = document.getElementById("initialLoader");
    const controls = document.getElementById("documentControls");
    const cancelButton = document.getElementById("cancelButton");
    const statusContainer = document.getElementById("documentStatus");

    const newButton = document.getElementById("newDocumentButton");
    const editButton = document.getElementById("editDocumentButton");
    const watchButton = document.getElementById("watchDocumentButton");

    if (loader) loader.remove();
    controls.style.display = "flex";

    newButton.style.display = "none";
    editButton.style.display = "none";
    watchButton.style.display = "none";
    cancelButton.style.display = "none";
    statusContainer.style.display = "none";

    switch (state) {
      case AppUIState.NEW:
        newButton.style.display = "inline-block";
        break;

      case AppUIState.DRAFT:
        editButton.style.display = "inline-block";
        cancelButton.style.display = "inline-block";
        statusContainer.style.display = "block";
        statusContainer.innerText = this.document?.statusName ?? "indefinido";
        break;

      case AppUIState.READY:
      case AppUIState.SIGNING:
      case AppUIState.DONE:
        watchButton.style.display = "inline-block";
        cancelButton.style.display = state === AppUIState.DONE ? "none" : "inline-block";
        statusContainer.style.display = "block";
        statusContainer.innerText = this.document?.statusName ?? "indefinido";
        break;

      default:
        console.warn("Estado de interface desconhecido:", state);
        newButton.style.display = "none";
        editButton.style.display = "none";
        watchButton.style.display = "none";
        cancelButton.style.display = "none";
        statusContainer.style.display = "none";
        if (errorMessage) {
          errorMessage.style.display = "block";
        }
    }
  }

  /***********************************
   * Utilitários
   ***********************************/
  get documentKey() {
    return `ticket:${this.ticket.display_id}`;
  }

  get shouldUnlinkDocument() {
    return this.document?.statusId === "6";
  }

  get documentUIState() {
    if (!this.document) return AppUIState.NEW;
    if (this.documentLoadFailed) return AppUIState.UNKNOWN;

    switch (this.document.statusId) {
      case "2":
        return AppUIState.DRAFT;
      case "3":
        return AppUIState.READY;
      case "4":
      case "5":
        return AppUIState.SIGNING;
      case "7":
        return AppUIState.DONE;
      default:
        return AppUIState.UNKNOWN;
    }
  }

  async notifyError(message) {
    await this.client.interface.trigger("showNotify", {
      type: "error",
      message
    });
  }

  async notifySuccess(message) {
    await this.client.interface.trigger("showNotify", {
      type: "success",
      message
    });
  }
}

/**
 * Utilitário para loading em botões
 */
function setLoading(button, isLoading) {
  if (!button) return;
  isLoading
    ? button.setAttribute("loading", true)
    : button.removeAttribute("loading");
}

/**
 * Inicialização e eventos da aplicação
 */
(async () => {
  const app = new App();
  await app.initializeClient();
""
  bindEventListeners(app);
})();

function bindEventListeners(app) {
  app.client.events.on("app.activated", async () => {
    await app.loadTicketData();
    await app.loadLinkedDocument();

    if (app.shouldUnlinkDocument) {
      await app.destroyDocumentLink();
    }

    app.renderInterface();
  });

  document.getElementById("reloadButton").addEventListener("click", async (e) => {
    const button = e.currentTarget;
    setLoading(button, true);

    await app.loadTicketData();
    await app.loadLinkedDocument();

    if (app.shouldUnlinkDocument) {
      await app.destroyDocumentLink();
    }

    app.renderInterface();
    setLoading(button, false);
  });

  document.getElementById("newDocumentButton").addEventListener("click", async (e) => {
    const button = e.currentTarget;
    setLoading(button, true);
    await app.openModal("newDocument", { ticket: app.ticket });

    setLoading(button, false);
  });

  document.getElementById("editDocumentButton").addEventListener("click", async (e) => {
    const button = e.currentTarget;
    setLoading(button, true);

    await app.openModal("draftDocument", { document: app.document });

    setLoading(button, false);
  });

  document.getElementById("watchDocumentButton").addEventListener("click", async (e) => {
    const button = e.currentTarget;
    setLoading(button, true);

    await app.openModal("trackDocument", { document: app.document });

    setLoading(button, false);
  });

  document.getElementById("cancelButton").addEventListener("click", async (e) => {
    const button = e.currentTarget;
    setLoading(button, true);
    await app.cancelDocument();
    setLoading(button, false);
  });

  app.client.instance.receive(async (event) => {
    console.log("Evento recebido:", event);

    if (event.data === "DOCUMENT_CREATED") {
      await app.loadTicketData();
      await app.loadLinkedDocument();

      if (app.shouldUnlinkDocument) {
        await app.destroyDocumentLink();
      }

      app.renderInterface();
      await app.openModal("draftDocument", { document: app.document });
    } else if (event.data === "DOCUMENT_LINKED") {
      console.log(event)
    }
  });
}
