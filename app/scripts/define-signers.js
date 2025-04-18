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
        this.agent = null;
        this.context = null

        // Componentes de Formulário
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
            this.context = await this.client.instance.context();

            console.log(this.context.data)

            await this._loadAgentData();

            // Cria e renderiza formulário

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
     * ############################################################################
     *                              MÉTODOS DE FORMULÁRIO
     * ############################################################################
     */

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
                    name: this.agent.name,
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
            //implementar
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
     * Lida com o reset do formulário (clique em "Reset Document").
     */
    _onResetDocument(e) {
        this.signForm.doReset(e);
    }

    /**
     * ############################################################################
     *                           MÉTODOS UTILITÁRIOS
     * ############################################################################
     */


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
