/********************************************************************************
 * FRESH D4Sign – Tela “Novo Documento” (new-document.js)
 * ------------------------------------------------------------------------------
 * Arquitetura alinhada ao index.js, seguindo o princípio da responsabilidade
 * única, com lógica de aplicação isolada na classe NewDocumentApp e binding de
 * eventos realizado externamente em bindEventListeners().
 ********************************************************************************/

class NewDocumentApp {
    constructor() {
        /** Client FW SDK */
        this.client = null;
        /** Contexto do iframe */
        this.context = null;
        /** Ticket corrente */
        this.ticket = null;
        /** Componente <fw-form> gerado dinamicamente */
        this.docForm = null;
        /** Componente <fw-form> gerado dinamicamente */
        this.linkForm = null;
        this.entityManager = null
        this.storageEntity = null
    }

    /***********************************
     * Inicialização
     ***********************************/
    async initializeClient() {
        try {
            this.client = await app.initialized();
            this.entityManager = await this.client.db.entity({ version: "v1" });
            this.storageEntity = await this.entityManager.get("ticketDocumentMapper");
        } catch (error) {
            console.log("Erro ao carregar client:", error);
            await this.notifyError("Erro ao carregar client");
        }
    }

    async loadContext() {
        try {
            this.context = await this.client.instance.context();
            this.ticket = this.context.data.ticket;
        } catch (error) {
            console.log("Erro ao obter contexto:", error);
            await this.notifyError("Erro ao obter informações do ticket");
        }
    }

    async loadTicketAttachments() {
        try {
            const [ticketResponse, itemsResponse] = await Promise.all([
                this.client.request.invokeTemplate("ViewTicket", {
                    context: { ticket_id: this.ticket.display_id },
                }),
                this.client.request.invokeTemplate("ViewTicketRequestedItems", {
                    context: { ticket_id: this.ticket.display_id },
                }),
            ]);

            const ticketData = JSON.parse(ticketResponse.response);
            const itemsData = JSON.parse(itemsResponse.response);

            const ticketAttachments = ticketData.ticket?.attachments ?? [];
            const itemsAttachments = (itemsData.requested_items ?? []).flatMap(
                (item) => item.attachments ?? []
            );

            this.ticket.attachments = [...ticketAttachments, ...itemsAttachments];
        } catch (error) {
            console.log(error);
            throw new Error(`Não foi possível recuperar os anexos do ticket. Código de status: ${error.status}`);
        }
    }

    async setupForms() {
        this.docForm = await this.createNewDocumentSubForm();
        this.linkForm = this.createLinkDocumentSubForm();
        document.querySelector("#form-new-document").prepend(this.docForm);
        document.querySelector("#form-link-document").prepend(this.linkForm);
    }

    /** Pipeline de boot da tela */
    async init() {
        await this.initializeClient();
        await this.loadContext();

        try {
            await this.loadTicketAttachments();
        } catch (err) {
            await this.notifyError(err.message);
        }

        await this.setupForms();
    }

    toggleFormByRadioSelection(event) {
        const selected = event.detail.value;
        if (selected === "create") {
            document.querySelector("#form-new-document").hidden = false
            document.querySelector("#form-link-document").hidden = true
        } else if (selected === "link") {
            console.log("oi")
            document.querySelector("#form-new-document").hidden = true
            document.querySelector("#form-link-document").hidden = false
        }
    }

    /***********************************
     * Formulário para criar novo documento
     ***********************************/
    async createNewDocumentSubForm() {
        const form = document.createElement("fw-form");

        const schema = {
            name: "Document Form",
            fields: [
                {
                    id: "document_name",
                    name: "document_name",
                    label: "Nome do Contrato",
                    type: "TEXT",
                    position: 1,
                    required: true,
                    placeholder: "Insira o nome do contrato",
                },
                {
                    id: "document_main_attachment",
                    name: "document_main_attachment",
                    label: "Selecione o anexo principal",
                    type: "DROPDOWN",
                    position: 2,
                    required: true,
                    placeholder: "Adicione o arquivo principal do documento",
                    choices: await this.generateAttachmentChoices(this.ticket.attachments),
                },
                {
                    id: "document_secondary_attachments",
                    name: "document_secondary_attachments",
                    label: "Selecione os anexos secundários",
                    type: "MULTI_SELECT",
                    position: 3,
                    required: false,
                    placeholder: "Os anexos serão adicionados na ordem em que forem selecionados",
                    disabled: true,
                    choices: [],
                },
            ],
        };

        const initialValues = {
            document_name: `#REQ-${this.ticket.display_id} - Contrato de ${this.ticket.subject} - SSA x `,
        };

        const validationSchema = Yup.object().shape({
            document_name: Yup.string().required("Nome do contrato é obrigatório"),
            document_main_attachment: Yup.string().required("Anexo principal é obrigatório"),
        });

        schema.fields = schema.fields.map(this.normalizeFormField);

        form.formSchema = schema;
        form.initialValues = initialValues;
        form.validationSchema = validationSchema;

        // Campo de anexos secundários inicia desabilitado
        form.setDisabledFields({ document_secondary_attachments: true });

        return form;
    }

    /***********************************
     * Formulário para vincular documento existente
     ***********************************/
    createLinkDocumentSubForm() {
        const form = document.createElement("fw-form");

        const schema = {
            name: "Link Existing Document Form",
            fields: [
                {
                    id: "document_uuid",
                    name: "document_uuid",
                    label: "ID do Documento",
                    type: "TEXT",
                    position: 1,
                    required: true,
                    placeholder: "Insira o ID do documento já existente",
                },
            ],
        };

        const initialValues = {
            document_uuid: "",
        };

        const validationSchema = Yup.object().shape({
            document_uuid: Yup.string().required("ID do documento é obrigatório"),
        });

        form.formSchema = schema;
        form.initialValues = initialValues;
        form.validationSchema = validationSchema;

        return form;
    }


    /***********************************
     * Manipulação de formulário
     ***********************************/
    handleDocumentFormChange({ detail }) {
        const { field, value } = detail;
        const container = document.getElementById("attachmentsSort");

        if (field === "document_main_attachment") {
            this.onMainAttachmentChange(container, value);
        }

        if (field === "document_secondary_attachments") {
            this.onSecondaryAttachmentsChange(container, value);
        }
    }

    async onMainAttachmentChange(container, value) {
        container.innerHTML = "";

        if (value) {
            // Habilita e preenche os anexos secundários
            const filtered = this.ticket.attachments.filter((att) => att.id !== value);
            const choices = this.generateAttachmentChoices(filtered);

            await this.docForm.setDisabledFields({ document_secondary_attachments: false });
            await this.docForm.setFieldChoices("document_secondary_attachments", choices);

            // Item fixo do anexo principal
            const main = this.ticket.attachments.find((att) => att.id === value);
            container.appendChild(this.createAttachmentDragItem(main, true));
        } else {
            await this.docForm.setDisabledFields({ document_secondary_attachments: true });
            await this.docForm.setFieldChoices("document_secondary_attachments", []);
        }
    }

    onSecondaryAttachmentsChange(container, values) {
        const existingMain = container.querySelector('fw-drag-item[pinned="top"]');
        container.innerHTML = "";
        if (existingMain) container.appendChild(existingMain);

        (values || []).forEach((secName) => {
            const attachment = this.ticket.attachments.find((att) => att.name === secName);
            if (attachment) container.appendChild(this.createAttachmentDragItem(attachment));
        });
    }

    /***********************************
     * Ações (botões)
     ***********************************/
    async submitDocument(e) {
        try {
            const { values, isValid } = await this.docForm.doSubmit(e);
            if (!isValid) return;

            const { response } = await this.submitDocumentFlow(values);
            if (response?.uuid) {
                try {
                    await this.client.instance.send({ message: "DOCUMENT_CREATED" });
                } catch (err) {
                    console.error(err);
                }
                this.client.instance.close();
            }
        } catch (error) {
            console.error("Erro no envio:", error);
            await this.notifyError(error.message || "Erro inesperado", "Erro ao enviar documento");
        }
    }

    async linkDocument(e) {
        try {
            const { values, isValid } = await this.linkForm.doSubmit(e);
            if (!isValid) return;
            let data = await this.storageEntity.create({ ticket_id: this.ticket.display_id, document_uuid: values.document_uuid })
            console.log(data)
            this.client.instance.close();

        } catch (error) {
            console.error("Erro no envio:", error);
            await this.notifyError(error.message || "Erro inesperado", "Erro ao enviar documento");
        }
    }

    async submitDocumentFlow(values) {
        const main = this.ticket.attachments.find((att) => att.id === values.document_main_attachment);
        const finalName = this.buildFilenameWithExtension(values.document_name, main.name);

        const container = document.getElementById("user_logs");
        const inline = document.createElement("fw-inline-message");
        inline.setAttribute("open", "");
        inline.setAttribute("type", "info");
        inline.setAttribute("duration", "Infinity");
        inline.innerText = "Iniciando envio do documento principal...";
        container.appendChild(inline);

        const loader = document.createElement("fw-progress-loader");
        loader.setAttribute("parent", "#user_logs");
        container.appendChild(loader);

        const start = () => loader.start();
        const done = () => loader.done();

        try {
            start();
            const result = await this.client.request.invoke("uploadAttachmentToD4sign", {
                attachment_url: main.attachment_url,
                mime_type: main.content_type,
                name: finalName,
            });

            const uuid = result.response.uuid;
            inline.setAttribute("type", "success");
            inline.innerText = `✅ Documento principal enviado. UUID: ${uuid}`;
            done();

            await this.submitSecondaryAttachments(values.document_secondary_attachments || [], uuid, inline, loader);

            start();
            await this.client.db.set(`ticket:${this.ticket.display_id}`, { document_uuid: uuid });
            done();

            await this.notifySuccess("Documento Criado 🙂", `${values.document_name} está pronto para receber assinaturas`);

            inline.setAttribute("type", "success");
            inline.innerText = "✅ Todos os anexos foram processados com sucesso.";
            done();

            await new Promise((r) => setTimeout(r, 3000));
            inline.remove();
            loader.remove();

            return result;
        } catch (err) {
            done();
            inline.setAttribute("type", "error");
            inline.innerText = `❌ Erro ao enviar documento principal: ${err.message}`;
            await this.notifyError(err.message, "Algo deu errado 🥲");
            throw err;
        }
    }

    async submitSecondaryAttachments(list, uuid, inline, loader) {
        for (const name of list) {
            const att = this.ticket.attachments.find((a) => a.name === name);
            const finalName = this.normalizeFilename(att.name);

            inline.setAttribute("type", "info");
            inline.innerText = `📎 Enviando anexo secundário: ${finalName}`;
            loader.start();
            const done = () => loader.done();

            try {
                await this.client.request.invoke("uploadSecondaryAttachmentToD4sign", {
                    attachment_url: att.attachment_url,
                    name: finalName,
                    uuid_document: uuid,
                });

                inline.setAttribute("type", "success");
                inline.innerText = `✅ Anexo ${finalName} enviado com sucesso.`;
            } catch (err) {
                inline.setAttribute("type", "error");
                inline.innerText = `❌ Erro ao enviar ${att.name}: ${err.message}`;
            }

            done();
            await new Promise((r) => setTimeout(r, 2000));
        }
    }

    resetDocument(e) {
        this.docForm.doReset(e);
    }

    radioGroupSelectHandler(e) {
        if (e.detail.value === "newDocument") {
            this.docForm.hidden = false
        }

        if (e.detail.value === "existingDocument") {
            this.docForm.hidden = true
        }
    }

    /***********************************
     * Utilitários
     ***********************************/
    normalizeFormField(field) {
        if (["DROPDOWN", "MULTI_SELECT"].includes(field.type)) {
            field.choices = field.choices.map((c) => ({ ...c, text: c.value, value: c.id }));
        }
        return field;
    }

    generateAttachmentChoices(attachments) {
        return attachments.map((att) => ({ id: att.id, value: att.name, text: att.name }));
    }

    createAttachmentDragItem(att, pinned = false) {
        const item = document.createElement("fw-drag-item");
        item.id = att.id;
        item.setAttribute("show-drag-icon", false);
        if (pinned) item.setAttribute("pinned", "top");
        item.innerText = att.name;
        return item;
    }

    buildFilenameWithExtension(customName, originalFilename) {
        const idx = originalFilename.lastIndexOf(".");
        const ext = idx !== -1 ? originalFilename.substring(idx) : "";
        return `${customName.trim()}${ext}`;
    }

    normalizeFilename(raw) {
        const dot = raw.lastIndexOf(".");
        const ext = dot !== -1 ? raw.substring(dot) : "";
        const base = (dot !== -1 ? raw.substring(0, dot) : raw)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9-_]/g, "_")
            .substring(0, 100);
        return `${base}${ext}`;
    }

    async notifyError(message, title = "Erro") {
        await this.client.interface.trigger("showNotify", { type: "error", title, message });
    }

    async notifySuccess(title, message) {
        await this.client.interface.trigger("showNotify", { type: "success", title, message });
    }
}

/***********************************
 * Helpers externos
 ***********************************/
function setLoading(button, isLoading) {
    if (!button) return;
    isLoading ? button.setAttribute("loading", true) : button.removeAttribute("loading");
}

function bindEventListeners(app) {
    // Mudanças no formulário
    app.docForm.addEventListener("fwFormValueChanged", (evt) => app.handleDocumentFormChange(evt));

    // Enviar documento
    document.getElementById("form-newDocument-submit").addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        setLoading(btn, true);
        await app.submitDocument(e);
        setLoading(btn, false);
    });

    // Vincular documento
    document.getElementById("form-linkDocument-submit").addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        setLoading(btn, true);
        await app.linkDocument(e);
        setLoading(btn, false);
    });

    // Resetar formulário
    document.getElementById("form-document-reset").addEventListener("click", (e) => app.resetDocument(e));

    document.getElementById("fw-radio-group").addEventListener("fwChange", (e) => app.toggleFormByRadioSelection(e));
}

/***********************************
 * Bootstrap
 ***********************************/
(async () => {
    const app = new NewDocumentApp();
    await app.init();
    bindEventListeners(app);
})();
