/********************************************************************************
 * FRESH D4Sign - Aplicação modular para envio e gerenciamento de documentos
 * ------------------------------------------------------------------------------
 * Refatorada com event handlers segmentados em funções menores, seguindo
 * princípios de código limpo e design modular, mas mantendo toda a lógica
 * no mesmo arquivo.
 ********************************************************************************/

class FreshD4SignApp {
    /**
     * ############################################################################
     *                           Variáveis de Instância
     * ############################################################################
     */
    constructor() {
        // Objetos principais
        this.client = null;
        this.ticket = null;
        this.agent = null;
        this.context = null

        // Componentes de Formulário
        this.docForm = null;
    }

    /**
     * ############################################################################
     *                                Inicialização
     * ############################################################################
     */
    async init() {
        try {
            this.client = await app.initialized();
            this.context = await this.client.instance.context();
            this.ticket = this.context.data.ticket

            // Carrega anexos do ticket
            try {
                this.ticket.attachments = await this._fetchTicketAttachments(
                    this.ticket.display_id
                );
            } catch (error) {
                await this._showError(error.message);
            }

            // Cria e renderiza formulários
            this.docForm = await this._createDocumentForm();
            document.querySelector("#form-document").prepend(this.docForm);

            // Registra os listeners de evento
            this._registerEventListeners();
        } catch (error) {
            console.error("Erro na inicialização do aplicativo:", error);
            await this._showError(error.message);
        }
    }

    /**
     * ############################################################################
     *                               MÉTODOS DE DADOS
     * ############################################################################
     */

    /**
     * Busca anexos do ticket chamando templates de request do Freshworks.
     * @param {number} ticketId - O display_id do ticket.
     * @returns {Promise<Array>} Retorna um array de anexos.
     */
    async _fetchTicketAttachments(ticketId) {
        try {
            const [ticketResponse, requestedItemsResponse] = await Promise.all([
                this.client.request.invokeTemplate("ViewTicket", {
                    context: { ticket_id: ticketId },
                }),
                this.client.request.invokeTemplate("ViewTicketRequestedItems", {
                    context: { ticket_id: ticketId },
                }),
            ]);

            const ticketData = JSON.parse(ticketResponse.response);
            const requestedItemsData = JSON.parse(requestedItemsResponse.response);

            const ticketAttachments = ticketData.ticket?.attachments || [];
            const requestedItems = requestedItemsData.requested_items || [];
            const requestedItemsAttachments = requestedItems.flatMap(
                (item) => item.attachments || []
            );

            return [...ticketAttachments, ...requestedItemsAttachments];
        } catch (error) {
            console.log(error);
            throw new Error(
                `Não foi possível recuperar os anexos do ticket. Código de status: ${error.status}`
            );
        }
    }

    /**
     * ############################################################################
     *                              MÉTODOS DE FORMULÁRIO
     * ############################################################################
     */

    /**
     * Cria o Formulário de Documento (docForm).
     * @returns {HTMLElement} fw-form configurado.
     */
    async _createDocumentForm() {
        const form = document.createElement("fw-form");

        // Define o schema do formulário
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
                    choices: await this._generateAttachmentChoices(this.ticket.attachments),
                },
                {
                    id: "document_secondary_attachments",
                    name: "document_secondary_attachments",
                    label: "Selecione os anexos secundários",
                    type: "MULTI_SELECT",
                    position: 3,
                    required: false,
                    placeholder:
                        "Os anexos serão adicionados na ordem em que forem selecionados",
                    disabled: true,
                    choices: [],
                },
            ],
        };

        // Valores iniciais
        const initialValues = {
            document_name: `#REQ-${this.ticket.display_id} - Contrato de ${this.ticket.subject} - SSA x `,
        };

        // Validação Yup
        const validationSchema = Yup.object().shape({
            document_name: Yup.string().required("Nome do contrato é obrigatório"),
            document_main_attachment: Yup.string().required(
                "Anexo principal é obrigatório"
            ),
        });

        // Normaliza campos
        schema.fields = schema.fields.map(this._normalizeFormField);

        // Atribuição ao componente
        form.formSchema = schema;
        form.initialValues = initialValues;
        form.validationSchema = validationSchema;

        // Desabilita anexos secundários até que um anexo principal seja selecionado
        form.setDisabledFields({ document_secondary_attachments: true });

        return form;
    }

    /**
     * ############################################################################
     *                        LISTENERS E SUB-FUNÇÕES DE EVENTO
     * ############################################################################
     */

    /**
     * Registra todos os listeners de evento. Cada listener aponta para métodos
     * específicos que tratam apenas aquela mudança.
     */
    _registerEventListeners() {
        // → Formulário de Documento
        this.docForm.addEventListener("fwFormValueChanged", (evt) =>
            this._handleDocumentFormChange(evt)
        );

        // → Botão "Enviar Documento"
        document
            .querySelector("#form-document-submit")
            .addEventListener("click", (e) => this._onSubmitDocument(e));

        // → Botão "Reset Document"
        document
            .querySelector("#form-document-reset")
            .addEventListener("click", (e) => this._onResetDocument(e));
    }

    /**
     * Trata o evento de mudança no Formulário de Documento.
     */
    _handleDocumentFormChange({ detail }) {
        const { field, value } = detail;
        const container = document.getElementById("attachmentsSort");

        // Se o anexo principal mudar...
        if (field === "document_main_attachment") {
            this._onMainAttachmentChange(container, value);
        }

        // Se os anexos secundários mudarem...
        if (field === "document_secondary_attachments") {
            this._onSecondaryAttachmentsChange(container, value);
        }
    }

    /**
     * Lida especificamente com a mudança do "anexo principal".
     */
    async _onMainAttachmentChange(container, value) {
        container.innerHTML = "";

        if (value) {
            // Habilita e atualiza os anexos secundários
            const filteredAttachments = this.ticket.attachments.filter(
                (att) => att.id !== value
            );
            const updatedChoices = this._generateAttachmentChoices(filteredAttachments);

            await this.docForm.setDisabledFields({
                document_secondary_attachments: false,
            });
            await this.docForm.setFieldChoices(
                "document_secondary_attachments",
                updatedChoices
            );

            // Cria item fixo do anexo principal
            const mainAttachment = this.ticket.attachments.find(
                (att) => att.id === value
            );
            container.appendChild(this._createAttachmentDragItem(mainAttachment, true));
        } else {
            // Desabilita e limpa os anexos secundários
            await this.docForm.setDisabledFields({
                document_secondary_attachments: true,
            });
            await this.docForm.setFieldChoices("document_secondary_attachments", []);
        }
    }

    /**
     * Lida especificamente com a mudança dos anexos secundários.
     */
    _onSecondaryAttachmentsChange(container, value) {
        const existingMain = container.querySelector('fw-drag-item[pinned="top"]');
        const secondaryValues = value || [];

        container.innerHTML = "";
        if (existingMain) {
            container.appendChild(existingMain);
        }

        secondaryValues.forEach((secName) => {
            const attachment = this.ticket.attachments.find((att) => att.name === secName);
            if (attachment) {
                container.appendChild(this._createAttachmentDragItem(attachment));
            }
        });
    }
    /**
     * Lida com o envio do Documento (clique em "Enviar Documento").
     */
    async _onSubmitDocument(e) {
        try {
            const { values, isValid } = await this.docForm.doSubmit(e);
            e.target.setAttribute("loading", true);
            if (isValid) {
                const { response } = await this._submitDocumentFlow(values, e.target);
                //const { response } = { response: { uuid: "4b0389e3-d3de-4b2a-bfe3-6a8649a116d0" }, values: values }
                if (response.uuid) {
                    try {
                        await this.client.instance.send({
                            message: "DOCUMENT_CREATED"
                        });
                    } catch (error) {
                        console.error(error);
                    }
                    this.client.instance.close()
                }
            }
        } catch (error) {
            console.error("Erro no envio:", error);
            await this._showError(
                error.message || "Erro inesperado",
                "Erro ao enviar documento"
            );
        } finally {
            e.target.setAttribute("loading", false);
        }
    }

    /**
     * Fluxo completo de envio de documento: principal e anexos secundários.
     */
    async _submitDocumentFlow(values) {

        const mainAttachment = this.ticket.attachments.find(
            (att) => att.id === values.document_main_attachment
        );

        const finalName = this._buildFilenameWithExtension(values.document_name, mainAttachment.name);
        const container = document.getElementById("user_logs");

        // Mensagem inline
        const inlineMessage = document.createElement("fw-inline-message");
        inlineMessage.setAttribute("open", "");
        inlineMessage.setAttribute("type", "info");
        inlineMessage.setAttribute("duration", "Infinity");
        inlineMessage.innerText = "Iniciando envio do documento principal...";
        container.appendChild(inlineMessage);

        // Loader de progresso
        const loader = document.createElement("fw-progress-loader");
        loader.setAttribute("parent", "#user_logs");
        container.appendChild(loader);

        const startProgress = () => loader.start();
        const endProgress = () => loader.done();

        try {
            startProgress();
            // Envia o anexo principal
            const result = await this.client.request.invoke("uploadAttachmentToD4sign", {
                attachment_url: mainAttachment.attachment_url,
                mime_type: mainAttachment.content_type,
                name: finalName,
            });

            const uuid = result.response.uuid;
            inlineMessage.setAttribute("type", "success");
            inlineMessage.innerText = `✅ Documento principal enviado. UUID: ${uuid}`;
            endProgress();

            // Envia anexos secundários
            await this._submitSecondaryAttachments(
                values.document_secondary_attachments || [],
                uuid,
                inlineMessage,
                loader
            );

            startProgress();

            await this.client.db.set(`ticket:${this.ticket.display_id}`, { "document_uuid": uuid }).then(
                function (data) {
                    console.log(data)
                    if (data.Created) {
                        inlineMessage.setAttribute("type", "success");
                        inlineMessage.innerText = `✅ UUID: ${uuid} Registrado no banco de dados`;
                    }
                });

            endProgress();

            // Conclusão
            await this._showSuccess(
                "Documento Criado 🙂",
                `${values.document_name} está pronto para receber assinaturas`
            );

            inlineMessage.setAttribute("type", "success");
            inlineMessage.innerText = "✅ Todos os anexos foram processados com sucesso.";
            endProgress();

            await new Promise(resolve => setTimeout(resolve, 3000))

            inlineMessage.remove();
            loader.remove();

            return result

        } catch (error) {
            endProgress();
            inlineMessage.setAttribute("type", "error");
            inlineMessage.innerText = `❌ Erro ao enviar documento principal: ${error.message}`;
            await this._showError(error.message, "Algo deu errado 🥲");
        }
    }

    /**
     * Envia os anexos secundários para o servidor D4sign.
     */
    async _submitSecondaryAttachments(secondaryAttachments, uuid, inlineMessage, loader) {
        for (const name of secondaryAttachments) {
            const att = this.ticket.attachments.find((a) => a.name === name);

            inlineMessage.setAttribute("type", "info");
            const finalName = this._normalizeFilename(att.name)
            inlineMessage.innerText = `📎 Enviando anexo secundário: ${finalName}`;
            loader.start();

            try {
                await this.client.request.invoke("uploadSecondaryAttachmentToD4sign", {
                    attachment_url: att.attachment_url,
                    name: finalName,
                    uuid_document: uuid,
                });

                inlineMessage.setAttribute("type", "success");
                inlineMessage.innerText = `✅ Anexo "${finalName}" enviado com sucesso.`;
            } catch (err) {
                inlineMessage.setAttribute("type", "error");
                inlineMessage.innerText = `❌ Erro ao enviar "${att.name}": ${err.message}`;
            }

            loader.done();
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    /**
     * Lida com o reset do formulário (clique em "Reset Document").
     */
    _onResetDocument(e) {
        this.docForm.doReset(e);
    }

    /**
     * ############################################################################
     *                           MÉTODOS UTILITÁRIOS
     * ############################################################################
     */

    _normalizeFormField(field) {
        if (["DROPDOWN", "MULTI_SELECT"].includes(field.type)) {
            field.choices = field.choices.map((choice) => ({
                ...choice,
                text: choice.value,
                value: choice.id,
            }));
        }
        return field;
    }

    _generateAttachmentChoices(attachments) {
        return attachments.map((att) => ({
            id: att.id,
            value: att.name,
            text: att.name,
        }));
    }

    _createAttachmentDragItem(attachment, pinned = false) {
        const item = document.createElement("fw-drag-item");
        item.id = attachment.id;
        item.setAttribute("show-drag-icon", false);
        if (pinned) item.setAttribute("pinned", "top");
        item.innerText = attachment.name;
        return item;
    }

    async _showError(message, title = "Erro") {
        await this.client.interface.trigger("showNotify", {
            type: "error",
            title,
            message,
        });
    }

    async _showSuccess(title, message) {
        await this.client.interface.trigger("showNotify", {
            type: "success",
            title,
            message,
        });
    }

    _buildFilenameWithExtension(customName, originalFilename) {
        // localiza o último ponto
        const lastDotIndex = originalFilename.lastIndexOf('.');
        if (lastDotIndex !== -1) {
            // extrai extensão (".pdf", ".docx", etc.)
            const extension = originalFilename.substring(lastDotIndex);
            // concatena, removendo espaços extras no final do customName
            return customName.trim() + extension;
        }
        // se não encontrar ponto, retorne só o customName
        // ou force algo como ".pdf" se preferir
        return customName;
    }

    _normalizeFilename(rawName) {
        const ext = rawName.includes('.') ? rawName.substring(rawName.lastIndexOf('.')) : '';
        const base = rawName.replace(ext, '');

        const normalized = base
            .normalize('NFD')                       // Remove acentos
            .replace(/[\u0300-\u036f]/g, '')       // Remove caracteres combinantes
            .replace(/[^a-zA-Z0-9-_]/g, '_')       // Substitui tudo que não é alfanumérico por "_"
            .substring(0, 100);                    // Limita a 100 caracteres

        return `${normalized}${ext}`;
    }
}

/**
 * ############################################################################
 *                           EXECUÇÃO DA APLICAÇÃO
 * ############################################################################
 */
(async () => {
    const appInstance = new FreshD4SignApp();
    await appInstance.init();
})();
