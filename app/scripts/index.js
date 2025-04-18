/********************************************************************************
 * FRESH D4Sign - Tela principal (index.js)
 * ------------------------------------------------------------------------------
 * Refatorado para manter clareza entre init e carregamento de estado, e aplicar
 * loading visual em botões de ação. Compatível com a UI atual.
 ********************************************************************************/

class App {
  constructor() {
    this.client = null;
    this.ticket = null;
    this.document = null;
  }

  async init() {
    try {
      await this._loadClient();
      this._addEventListeners();
    } catch (error) {
      console.log("Erro ao inicializar o app index:", error);
    }
  }

  _addEventListeners() {
    this.client.events.on("app.activated", async () => {
      this._renderText();
      await this._loadAndRenderState();
    });

    document.getElementById("reloadButton").addEventListener("click", async (e) => {
      const button = e.currentTarget;
      button.setAttribute("loading", true);
      await this._loadAndRenderState();
      button.removeAttribute("loading");
    });

    document.getElementById("actionButton").addEventListener("click", async (e) => {
      const button = e.currentTarget;
      button.setAttribute("loading", true);

      if (!this.document) {
        await this._openNewDocumentModal();
      } else if (this.document.statusId === "2") {
        await this._openSignersModal();
      } else {
        await this._openTrackingModal?.(); // opcional
      }

      button.removeAttribute("loading");
    });

    document.getElementById("cancelButton").addEventListener("click", async (e) => {
      const button = e.currentTarget;
      button.setAttribute("loading", true);
      await this._cancelDocument();
      button.removeAttribute("loading");
    });

    this.client.instance.receive(async (event) => {
      console.log("Evento recebido:", event);

      if (event.data === "DOCUMENT_CREATED") {
        await this._loadAndRenderState();
        await this._openSignersModal();
      }
    });
  }

  async _openNewDocumentModal() {
    try {
      await this.client.interface.trigger("showModal", {
        title: "Novo Contrato",
        template: "views/new-document.html",
        data: { ticket: this.ticket }
      });
    } catch (error) {
      console.log("Erro ao abrir modal de novo contrato:", error);
      await this._showError("Erro ao abrir modal de novo contrato");
    }
  }

  async _openSignersModal() {
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.client.interface.trigger("showModal", {
        title: "Signatários",
        template: "views/define-signers.html",
        data: { document: this.document },
      });
    } catch (error) {
      console.log("Erro ao abrir modal de signatários:", error);
      await this._showError("Erro ao abrir modal de signatários");
    }
  }

  _renderText() {
    console.log("Fresh4Sign: Cliente iniciado com sucesso", this.client);
  }

  async _loadClient() {
    try {
      this.client = await app.initialized();
    } catch (error) {
      console.log("Erro ao carregar client:", error);
      await this._showError("Erro ao carregar client");
    }
  }

  async _loadTicketData() {
    try {
      const data = await this.client.data.get("ticket");
      this.ticket = data.ticket;
    } catch (error) {
      console.log("Erro ao carregar dados do ticket:", error);
      await this._showError("Erro ao carregar dados do ticket");
    }
  }

  async _loadDocument() {
    try {
      const key = `ticket:${this.ticket.display_id}`;
      const dbData = await this.client.db.get(key);

      if (!dbData?.document_uuid) return;

      const response = await this.client.request.invokeTemplate("getDocumentOnD4sign", {
        context: { document_uuid: dbData.document_uuid }
      });

      const [document] = JSON.parse(response.response);
      console.log("Documento encontrado:", document);

      if (document.statusId === "6") {
        console.log("Documento cancelado. Limpando vínculo do ticket.");
        const deletion = await this.client.db.delete(key);
        if (deletion?.Deleted) {
          this.document = null;
          console.log("Vínculo removido do DB com sucesso.");
        }
      } else {
        this.document = document;
      }

    } catch (error) {
      if (error.status !== 404) {
        console.log("Erro ao carregar documento vinculado:", error);
        await this._showError("Erro ao buscar documento na D4Sign");
      }
    }
  }

  async _cancelDocument() {
    try {
      const data = await this.client.request.invokeTemplate("cancelDocumentOnD4sign", {
        context: { document_uuid: this.document.uuidDoc }
      });
      const [document] = JSON.parse(data.response);
      console.log(document);

      if (document.statusId === 6) {
        await this._showSuccess(`${document.nameDoc} foi cancelado com sucesso`)
        await this._loadAndRenderState();
      }
    } catch (error) {
      console.log("Erro ao cancelar documento:", error);
      await this._showError("Ocorreu uma falha ao tentar cancelar o documento");
    }
  }

  async _showError(message) {
    await this.client.interface.trigger("showNotify", {
      type: "error",
      message
    });
  }

  async _showSuccess(message) {
    await this.client.interface.trigger("showNotify", {
      type: "success",
      message
    });
  }

  /**
   * Carrega os dados e atualiza a interface com base no estado atual do ticket/documento.
   */
  async _loadAndRenderState() {
    await this._loadTicketData();
    await this._loadDocument();

    requestAnimationFrame(() => {
      this._renderUIBasedOnDocument();
    });
  }

  _renderUIBasedOnDocument() {
    const loader = document.getElementById("initialLoader");
    const controls = document.getElementById("documentControls");
    const actionButton = document.getElementById("actionButton");
    const cancelButton = document.getElementById("cancelButton");
    const statusContainer = document.getElementById("documentStatus");

    if (loader) loader.remove();
    controls.style.display = "flex";

    if (!this.document) {
      actionButton.innerHTML = `
        <fw-icon name="upload" size="16" slot="before-label"></fw-icon>
        Novo Documento
      `;
      cancelButton.style.display = "none";
      statusContainer.style.display = "none";
      return;
    }

    cancelButton.style.display = "inline-block";
    statusContainer.style.display = "block";
    statusContainer.innerText = `${this.document.statusName}`;

    switch (this.document.statusId) {
      case "2":
        actionButton.innerHTML = `
          <fw-icon name="link" size="16" slot="before-label"></fw-icon>
          Definir Signatários
        `;
        break;

      case "3":
        actionButton.innerHTML = `
          <fw-icon name="file-text" size="16" slot="before-label"></fw-icon>
          Visualizar Documento
        `;
        break;

      default:
        actionButton.innerHTML = `
          <fw-icon name="file-text" size="16" slot="before-label"></fw-icon>
          Detalhes do Documento
        `;
        break;
    }
  }
}

/**
 * Inicialização da aplicação index.
 */
(async () => {
  const fresh4sign = new App();
  await fresh4sign.init();
})();
