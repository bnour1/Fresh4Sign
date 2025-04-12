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

        // Componentes de Formulário
        this.docForm = null;
        this.signForm = null;

        // Tabela de signatários
        this.signTable = null;
    }

    /**
     * ############################################################################
     *                                Inicialização
     * ############################################################################
     */
    async init() {
        try {
            this.client = await app.initialized();
            await this._loadTicketData();
            await this._loadAgentData();

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

            this.signForm = this._createSignatoriesForm();
            document.querySelector("#form-signatarios").prepend(this.signForm);

            // Cria e inicializa a tabela de signatários
            this.signTable = this._createSignatoriesTable();

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
     * Carrega o objeto Ticket.
     */
    async _loadTicketData() {
        await this.client.data.get("ticket").then(
            (data) => {
                this.ticket = data.ticket;
                console.log(this.ticket);
            },
            (error) => {
                console.log(error);
            }
        );
    }

    /**
     * Carrega o objeto Agent.
     */
    async _loadAgentData() {
        await this.client.data.get("agent").then(
            (data) => {
                this.agent = data.agent.user || data.agent;
            },
            (error) => {
                console.log(error);
            }
        );
    }

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
     * Cria o Formulário de Signatários (signForm).
     * @returns {HTMLElement} fw-form configurado.
     */
    _createSignatoriesForm() {
        const form = document.createElement("fw-form");

        const schema = {
            name: "Signatarios Form",
            fields: [
                {
                    id: "signatory_name",
                    name: "signatory_name",
                    label: "Nome do Signatário",
                    type: "TEXT",
                    required: true,
                    placeholder: "Insira o nome do signatário",
                },
                {
                    id: "signatory_cpf",
                    name: "signatory_cpf",
                    label: "CPF do Signatário",
                    type: "TEXT",
                    required: true,
                    placeholder: "Insira o CPF do signatário",
                },
                {
                    id: "signatory_email",
                    name: "signatory_email",
                    label: "E-mail do Signatário",
                    type: "EMAIL",
                    required: true,
                    placeholder: "Insira o e-mail do signatário",
                },
                {
                    id: "signatory_type",
                    name: "signatory_type",
                    label: "Tipo de signatário",
                    type: "DROPDOWN",
                    required: true,
                    placeholder: "Selecione o tipo de signatário",
                    choices: [
                        { id: "Aprovador", value: "Aprovador" },
                        { id: "Testemunha", value: "Testemunha" },
                        { id: "Representante", value: "Representante" },
                        { id: "Acusar Recebimento", value: "Acusar Recebimento" },
                        { id: "Observador", value: "Observador" },
                    ],
                },
                {
                    id: "signature_type",
                    name: "signature_type",
                    label: "Tipo de Assinatura",
                    type: "DROPDOWN",
                    required: true,
                    placeholder: "Selecione o tipo de assinatura",
                    choices: [
                        { id: "Normal", value: "Normal" },
                        { id: "Certificado", value: "Certificado" },
                        { id: "Não aplicavel", value: "Não aplicavel" },
                    ],
                },
                {
                    id: "signature_certificate",
                    name: "signature_certificate",
                    label: "Certificado",
                    type: "DROPDOWN",
                    required: true,
                    placeholder: "Selecione o Certificado",
                    hidden: true,
                    choices: [],
                },
                {
                    id: "signatory_order",
                    name: "signatory_order",
                    label: "Posição da assinatura",
                    type: "NUMBER",
                    required: true,
                    placeholder: "Em qual ordem ele deve estar",
                },
            ],
        };

        const validationSchema = Yup.object().shape({
            signatory_name: Yup.string().required("Nome do signatário é obrigatório"),
            signatory_cpf: Yup.string()
                .required("CPF é obrigatório")
                .test(
                    "valid-cpf-length",
                    "CPF deve conter 11 dígitos",
                    (value) => {
                        const digits = (value || "").replace(/\D/g, "");
                        return digits.length === 11;
                    }
                ),
            signatory_email: Yup.string()
                .email("E-mail inválido")
                .required("E-mail é obrigatório"),
            signatory_type: Yup.string().required("Tipo de signatário é obrigatório"),
            signature_type: Yup.string().required("Tipo de assinatura é obrigatório"),
            signature_certificate: Yup.string().when("signature_type", {
                is: "Certificado",
                then: (schema) =>
                    schema.required(
                        "Certificado é obrigatório quando a assinatura é do tipo Certificado"
                    ),
                otherwise: (schema) => schema.notRequired(),
            }),
            signatory_order: Yup.number().required(
                "Posição da assinatura é obrigatória"
            ),
        });

        schema.fields = schema.fields.map(this._normalizeFormField);
        form.formSchema = schema;
        form.validationSchema = validationSchema;

        return form;
    }

    /**
     * ############################################################################
     *                              MÉTODOS DE TABELA
     * ############################################################################
     */
    _createSignatoriesTable() {
        const data = {
            columns: [
                { key: "signatory", text: "Signatário", variant: "user" },
                { key: "cpf", text: "CPF", hide: true },
                { key: "signatory_type", text: "Tipo" },
                { key: "signature_type", text: "Assinatura", hide: true },
                {
                    key: "signatory_order",
                    text: "Nº",
                    widthProperties: { width: "40px" },
                },
            ],
            rows: [],
            rowActions: [
                {
                    name: "Delete",
                    handler: (rowData) => {
                        const table = document.querySelector("#datatable-signatories");
                        table.rows = table.rows.filter((row) => row.id !== rowData.id);
                    },
                    iconName: "delete",
                },
            ],
        };

        // Somente insere a linha se existir um agente com e-mail
        if (this.agent && this.agent.email) {
            data.rows.push({
                signatory: {
                    name: this.ticket.responder_name,
                    email: this.agent.email,
                },
                cpf: "",
                signatory_type: "Aprovador",
                signature_type: "Normal",
                signatory_order: 1,
            });
        }


        const table = document.getElementById("datatable-signatories");
        table.columns = data.columns;
        table.rows = data.rows;
        table.rowActions = data.rowActions;
        table.showRowActionsAsMenu = true;
        table.rowActionsHeaderLabel = "";

        // Adiciona método de validação à tabela
        table.validate = function () {
            if (!this.rows || this.rows.length === 0) {
                throw new Error("Ao menos um signatário precisa ser adicionado.");
            }

            const orders = this.rows
                .map((row) => Number(row.signatory_order))
                .filter((n) => !isNaN(n));

            if (orders.length === 0) {
                throw new Error(
                    "Todos os signatários precisam ter um número de ordem válido."
                );
            }

            orders.sort((a, b) => a - b);
            const [min, max] = [orders[0], orders[orders.length - 1]];
            const uniqueOrders = new Set(orders);

            const isSequenceValid = Array.from(
                { length: max - min + 1 },
                (_, i) => i + min
            ).every((n) => uniqueOrders.has(n));

            if (!isSequenceValid) {
                throw new Error(
                    "A ordem dos signatários deve ser uma sequência contínua (ex: 1,2,3)."
                );
            }

            return true;
        };

        return table;
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

        // → Formulário de Signatários
        this.signForm.addEventListener("fwFormValueChanged", (evt) =>
            this._handleSignatoryFormChange(evt)
        );

        // → Botão "Adicionar Signatário"
        document
            .querySelector("#form-signatories-add")
            .addEventListener("click", (e) => this._onAddSignatory(e));

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
    async _handleDocumentFormChange({ detail }) {
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
     * Trata o evento de mudança no Formulário de Signatários.
     */
    _handleSignatoryFormChange({ detail }) {
        const { field, value } = detail;

        // Exibe/esconde o campo de certificado se o tipo de assinatura for "Certificado"
        if (field === "signature_type") {
            if (value === "Certificado") {
                this.signForm.setHiddenFields({ signature_certificate: false });
            } else {
                this.signForm.setHiddenFields({ signature_certificate: true });
            }
        }
    }

    /**
     * Função para lidar com o clique em "Adicionar Signatário".
     */
    async _onAddSignatory(e) {
        const { values, errors, isValid } = await this.signForm.doSubmit(e);

        if (isValid) {
            const newRow = {
                id: values.signatory_email,
                signatory: {
                    name: values.signatory_name,
                    email: values.signatory_email,
                },
                cpf: values.signatory_cpf,
                signatory_type: values.signatory_type,
                signature_type: values.signature_type,
                signatory_order: values.signatory_order,
            };

            // Adiciona a nova linha na tabela
            this.signTable.rows = [...this.signTable.rows, newRow];

            // Reseta o formulário
            this.signForm.doReset(e);
        } else {
            // Aplica visualmente os erros
            const formattedErrors = this._formatFormErrors(errors, this.signForm);
            this.signForm.setFieldErrors(formattedErrors);
        }
    }

    /**
     * Formata os erros de formulário baseados nas mensagens e schema.
     */
    _formatFormErrors(errors, form) {
        const formattedErrors = {};
        Object.entries(errors).forEach(([fieldName, message]) => {
            const fieldSchema = form.formSchema.fields.find((f) => f.name === fieldName);
            formattedErrors[fieldName] =
                message || `${fieldSchema?.label || fieldName} é obrigatório.`;
        });
        return formattedErrors;
    }

    /**
     * Lida com o envio do Documento (clique em "Enviar Documento").
     */
    async _onSubmitDocument(e) {
        try {
            const { values, isValid } = await this.docForm.doSubmit(e);
            e.target.setAttribute("loading", true);

            if (isValid && this.signTable.validate()) {
                await this._submitDocumentFlow(values, e.target);
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
        console.log(mainAttachment.name)
        console.log(finalName)
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

        console.log(mainAttachment)

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

            // Conclusão
            await this._showSuccess(
                "Documento Criado 🙂",
                `${values.document_name} está pronto para receber assinaturas`
            );

            inlineMessage.setAttribute("type", "success");
            inlineMessage.innerText = "✅ Todos os anexos foram processados com sucesso.";
            endProgress();

            setTimeout(() => {
                inlineMessage.remove();
                loader.remove();
            }, 5000);
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
            inlineMessage.innerText = `📎 Enviando anexo secundário: ${att.name}`;
            loader.start();

            try {
                await this.client.request.invoke("uploadSecondaryAttachmentToD4sign", {
                    attachment_url: att.attachment_url,
                    name: att.name,
                    uuid_document: uuid,
                });

                inlineMessage.setAttribute("type", "success");
                inlineMessage.innerText = `✅ Anexo "${att.name}" enviado com sucesso.`;
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
