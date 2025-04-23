/********************************************************************************
 * FRESH D4Sign – Tela “Definir Signatários” (define‑signers.js)
 * ------------------------------------------------------------------------------
 * Implementação completa com envio de signatários para a D4Sign.
 *  • Classe DefineSignersController → lógica de negócio
 *  • bindEventListeners() externo → vincula UI
 *  • this.signers mantém o payload pronto para a API
 ********************************************************************************/

class DraftDocumentController {
    constructor(client) {
        this.client = client;

        this.context = null;
        this.agent = null;
        this.document = null
        this.signForm = null;
        this.signTable = null;
        this.signers = [];
    }

    async loadAgentData() {
        const { agent } = await this.client.data.get("agent");
        return agent?.user ?? agent;
    }

    async loadSigners() {
        try {
            const { response } = await this.client.request.invokeTemplate("listDocumentSignersOnD4sign", {
                context: { document_uuid: this.document.uuidDoc }
            });
            const [documentData] = JSON.parse(response)
            return documentData.list
        } catch (e) {
            this.notifyError("Ocorreu um erro ao carregar o signatários")
            console.log(e)
        }

    }

    /** Pipeline principal */
    async init() {
        try {
            this.context = await this.client.instance.context();
            this.document = this.context.data.document
            this.agent = await this.loadAgentData();
            this.signers = await this.loadSigners();
            this.createSignatoriesForm()
            this.createSignatoriesTable();
            this.populateSignatoriesTable();
        } catch (err) {
            console.error(err);
            await this.notifyError(err.message || "Falha de inicialização");
        }
    }

    /***********************************
     * Construção de UI
     ***********************************/
    createSignatoriesForm() {
        const SIGNATORY_TYPE_CHOICES = [
            { id: "2", value: "Aprovar" },          // act 2
            { id: "5", value: "Testemunha" },       // act 5
            { id: "4", value: "Representante" },    // act 4 – Assinar como parte
            { id: "7", value: "Receber" },          // act 7 – Acusar recebimento
            { id: "1", value: "Assinar" },          // act 1 – Assinar (padrão)
        ];

        const SIGNATURE_TYPE_CHOICES = [
            { id: "Normal", value: "Normal" },
            { id: "Certificado", value: "Certificado" },
            { id: "NaoAplicavel", value: "Não aplicável" },
        ];

        const form = document.createElement("fw-form");
        const schema = {
            name: "Signatarios Form",
            fields: [
                { id: "signatory_name", name: "signatory_name", label: "Nome", type: "TEXT", required: true },
                { id: "signatory_cpf", name: "signatory_cpf", label: "CPF", type: "TEXT", required: true },
                { id: "signatory_email", name: "signatory_email", label: "E‑mail", type: "EMAIL", required: true },
                { id: "signatory_type", name: "signatory_type", label: "Ação", type: "DROPDOWN", required: true, choices: SIGNATORY_TYPE_CHOICES },
                { id: "signature_type", name: "signature_type", label: "Assinatura", type: "DROPDOWN", required: true, choices: SIGNATURE_TYPE_CHOICES },
                { id: "signature_certificate", name: "signature_certificate", label: "Certificado", type: "DROPDOWN", hidden: true, required: true, choices: [] },
                { id: "signatory_order", name: "signatory_order", label: "Ordem", type: "NUMBER", required: true, placeholder: "Ex.: 1" },
            ],
        };

        const validationSchema = Yup.object().shape({
            signatory_name: Yup.string().required("Nome é obrigatório"),
            signatory_cpf: Yup.string().required("CPF é obrigatório").test("len", "CPF deve ter 11 dígitos", (v) => (v || "").replace(/\D/g, "").length === 11),
            signatory_email: Yup.string().email("E‑mail inválido").required("E‑mail é obrigatório"),
            signatory_type: Yup.string().required("Ação é obrigatória"),
            signature_type: Yup.string().required("Tipo de assinatura é obrigatório"),
            signature_certificate: Yup.string().when("signature_type", {
                is: "Certificado",
                then: (sch) => sch.required("Certificado é obrigatório"),
                otherwise: (sch) => sch.notRequired(),
            }),
            signatory_order: Yup.number().required("Ordem é obrigatória"),
        });

        schema.fields = schema.fields.map(this.normalizeFormField);
        form.formSchema = schema;
        form.validationSchema = validationSchema;
        this.signForm = form;
        document.querySelector("#form-signers").prepend(this.signForm);
    }

    createSignatoriesTable() {
        const table = document.getElementById("datatable-signatories");
        const cfg = {
            columns: [
                { key: "signatory", text: "Signatário", variant: "user" },
                { key: "act", text: "Ação" },
                { key: "signature_type", text: "Assinatura" },
                { key: "signatory_order", text: "Nº", widthProperties: { width: "40px" } },
            ],
            rows: [],
            rowActions: [
                {
                    name: "Delete",
                    iconName: "delete",
                    handler: async (rowData) => {
                        console.log(rowData)
                        const body = {
                            "key-signer": rowData.key_signer,
                            "email-signer": rowData.signatory.email
                        }
                        try {
                            table.isLoading = true;

                            const { response, status } = await this.client.request.invokeTemplate("removeDocumentSignerOnD4sign", {
                                context: { document_uuid: this.document.uuidDoc },
                                body: JSON.stringify(body)
                            });

                            if (status === 200) {
                                // Remove localmente o signatário da lista
                                this.signers = this.signers.filter(s => s.key_signer !== rowData.key_signer);

                                this.notifySuccess(`Signatário ${rowData.signatory.email} removido com sucesso.`);
                                console.log(`Signatário ${rowData.signatory.email} removido com sucesso.`, response);
                            } else {
                                this.notifyError(`Erro ao remover signatário. Status ${status}.`);
                                console.log(`Erro ao remover signatário. Status ${status}`, response);
                            }

                        } catch (e) {
                            this.notifyError(`Não foi possível remover o signatário ${rowData.signatory.email}.`);
                            console.log(`Não foi possível remover o signatário ${rowData.signatory.email}.`, e);

                        } finally {
                            this.populateSignatoriesTable();
                            table.isLoading = false;
                        }

                    },
                },
            ],
        };

        table.columns = cfg.columns;
        table.rows = cfg.rows;
        table.rowActions = cfg.rowActions;
        table.showRowActionsAsMenu = true;
        table.rowActionsHeaderLabel = "";

        this.table = table;
    }

    populateSignatoriesTable() {
        const table = document.getElementById("datatable-signatories");
        if (!table) throw new Error("Tabela #datatable-signatories não encontrada.");

        if (!Array.isArray(this.signers) || !this.signers.length) {
            table.shimmerCount = 0
            table.rows = []
            console.warn("Nenhum signatário em this.signers");
            return;
        }

        table.shimmerCount = this.signers.length

        // mapeia códigos do campo `type` (1 = Assinar, 2 = Aprovar, etc.)
        const typeToAct = {
            "1": "Assinar",
            "2": "Aprovar",
        };

        // converte cada objeto da API em uma linha para a tabela
        const signerRows = this.signers.map((s, idx) => ({
            key_signer: s.key_signer || s.email || `row-${idx}`,                 // chave única
            signatory: { name: s.user_name, email: s.email },            // coluna "Signatário"
            cpf: s.user_document,                                        // você decide exibir ou não
            act: typeToAct[s.type] ?? s.nomenclatura ?? "Assinar",       // coluna "Ação"
            signature_type: s.certificadoicpbr === "1" ? "ICP-Brasil"
                : "Normal",       // coluna "Assinatura"
            signatory_order: idx + 1,                                    // coluna "Nº"
        }));

        // mantém linhas já presentes (por exemplo, o agente logado)
        table.rows = signerRows
    }

    /***********************************
     * Manipuladores de UI
     ***********************************/
    handleSignatoryFormChange({ detail }) {
        const { field, value } = detail;
        if (field === "signature_type") {
            this.signForm.setHiddenFields({ signature_certificate: value !== "Certificado" });
        }
    }

    async addSignatory(e) {
        const { values, isValid } = await this.signForm.doSubmit(e);

        if (!isValid) {
            this.notifyError("Formulário Inválido");
            console.log("formulário inválido");
            return;
        };

        const signerPayload = {
            email: values.signatory_email,
            act: values.signatory_type,           // 1 = assinar, 2 = aprovar, etc
            foreign: "0",                         // assume brasileiro por padrão
            certificadoicpbr: values.signature_type === "ICP-Brasil" ? "1" : "0",
            assinatura_presencial: "0",
            docauth: "0",
            docauthandselfie: "0",
            embed_methodauth: "email",
            embed_smsnumber: "",
            upload_allow: "0",
            upload_obs: "",
            password_code: "",                    // incluir se quiser proteger com senha
            auth_pix: "0",
            videoselfie: "0",
            d4sign_score: "0"
        };

        const payload = {
            signers: [signerPayload]
        };

        try {
            const { response, status } = await this.client.request.invokeTemplate("addDocumentSignersOnD4sign", {
                context: { document_uuid: this.document.uuidDoc },
                body: JSON.stringify(payload)
            });

            // Remove localmente o signatário da lista
            if (status === 200) {
                const data = JSON.parse(response);
                const signer = data.message?.[0];
                if (!Array.isArray(this.signers)) this.signers = [];
                this.signers.push(signer)
            }

            console.log("Signatário adicionado com sucesso:", response);
            this.notifySuccess("Signatário adicionado com sucesso!");
        } catch (err) {
            console.log("Erro ao adicionar signatário:", err);
            this.notifyError("Erro ao adicionar signatário.");
        } finally {
            this.populateSignatoriesTable();
        }
    }


    async submitDocument(e) {
        try {
            const { response } = await this.client.request.invokeTemplate("sendDocumentOnD4sign", {
                context: { document_uuid: this.document.uuidDoc },
                body: JSON.stringify({
                    skip_email: "0",
                    workflow: "1",
                })
            });
            console.log(response)
            await this.notifySuccess(`${this.document.nameDoc} Foi enviado para assinatura com sucesso!`)
            await this.client.instance.send({ message: "DOCUMENT_SENT" });
            this.client.instance.close();
        } catch (err) {
            await this.notifyError(
                err?.message || "Ocorreu um problema no envio. Tente novamente mais tarde."
            );

        } finally {
            e.currentTarget && e.currentTarget.setAttribute("loading", false);
        }
    }

    resetForm(e) {
        this.signForm.doReset(e);
    }

    /***********************************
     * Utilitários
     ***********************************/
    normalizeFormField(f) {
        if (["DROPDOWN", "MULTI_SELECT"].includes(f.type)) {
            f.choices = f.choices.map((c) => ({ ...c, text: c.value, value: c.id }));
        }
        return f;
    }

    formatFormErrors(errs) {
        const out = {};
        Object.entries(errs).forEach(([field, msg]) => {
            const label = this.signForm.formSchema.fields.find((f) => f.name === field)?.label || field;
            out[field] = msg || `${label} é obrigatório.`;
        });
        return out;
    }

    async notifyError(message) {
        await this.client.interface.trigger("showNotify", { type: "error", message });
    }

    async notifySuccess(message) {
        await this.client.interface.trigger("showNotify", { type: "success", message });
    }
}

/***********************************
 * Helpers externos
 ***********************************/
function setLoading(btn, state) {
    if (!btn) return;
    state ? btn.setAttribute("loading", true) : btn.removeAttribute("loading");
}

function bindEventListeners(script) {
    script.signForm.addEventListener("fwFormValueChanged", (evt) => script.handleSignatoryFormChange(evt));
    document.getElementById("form-signatories-add").addEventListener("click", async (e) => await script.addSignatory(e));
    document.getElementById("form-document-submit").addEventListener("click", (e) => script.submitDocument(e));
    document.getElementById("form-document-reset").addEventListener("click", (e) => script.resetForm(e));
}

/***********************************
 * Bootstrap
 ***********************************/
(async () => {
    const script = new DraftDocumentController(await app.initialized())
    await script.init()

    bindEventListeners(script);
})();
