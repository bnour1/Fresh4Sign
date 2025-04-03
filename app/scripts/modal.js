// Global variables
let client;
let context;
let docForm;
let signForm;
let signTable;

init();

async function init() {
    client = await app.initialized();
    context = await client.instance.context();

    context.data = getMockContextData();

    docForm = await buildDocumentForm();
    document.querySelector('#form-document').prepend(docForm);

    signForm = buildSignatariosForm();
    document.querySelector('#form-signatarios').prepend(signForm);

    signTable = buildSignatoryTable();

    addEventListeners();
}

function getMockContextData() {
    return {
        "service_item_name": "Mútuo",
        "ticket_id": 157027,
        "attachments": [
            {
                "attachment_url": "https://ssabrhelpdesk.attachments.freshservice.com/data/helpdesk/attachments/production/19067505293/original/AUTORIZA%C3%87%C3%83O%20-%20ALL%20ENERGY.pdf?response-content-type=application/pdf&Expires=1742913965&Signature=HkvV2mtC7pTwKtbrHG8Gsgm733Dyhs2pt18kHs-Uc0Q-LtUiler0fQFkzwIonmAvDMBwYacDZTzu6FefcL6yCrVBeWIKfNrCSMMD9zvE6POu~oBUS1k7PBjtYhrEBdIkaKKTRZKA8ui96tRUqyNCouxd6FdNYJ7QpZK8NOypYMJjdAXgN2LtAlHuCDdJOiR0y7Xox4OKZ7XwSe0iZUAJRXyLOGWWpCmjHei9SuROuEXy4AgJe4ReAqed4Gavo0~PIH7pC-RjGQwPPTJOfZbNMBG5xO0BnpYFVqVnf9VzSUVs-gFtrU43qu-CoHhTqRi59BT64JKotS49InEmVe7S-g__&Key-Pair-Id=APKAIPHBXWY2KT5RCMPQ",
                "canonical_url": "https://ssabrhelpdesk.freshservice.com/helpdesk/attachments/19067505293",
                "content_type": "application/pdf",
                "created_at": "2025-03-24T13:22:00Z",
                "has_access": true,
                "id": 19067505293,
                "name": "Doc1.pdf",
                "size": 116207,
                "updated_at": "2025-03-24T13:22:45Z"
            },
            {
                "attachment_url": "https://ssabrhelpdesk.attachments.freshservice.com/data/helpdesk/attachments/production/190672505306/original/tabela%20sap%20.pdf?response-content-type=application/pdf&Expires=1742913965&Signature=DhlWYfsEJSI1z6nRpeZhm8vREB~dn2xeFtGHPo-oQTIYPYZzd8GGeyFRVtzxDt1QzD6jUHkx7XaFNb7WSv4uJunJgXRW4R9HQxR6OXXWJudsovdTgHife9~rO~-iWT1s4kQIEbecZnQSzF4Y~QXIX0JlwOQXMyuWf5BNttriQxt-rCHHUJ5Q6tjoYdBJcs668a9rlDfRecLUEBS8iftKuonS2IuGU1kpKtdHL0qFvz5RrwmR47Ueh6PNFEv1crZPlXOMhxlLQW5YcOt~cvXRZrgvxk9sGT~LoH45h45Vy~3QV1IS8fubA2~vQIDe-WHoYbCOVYJrM2obiOr12kAlNg__&Key-Pair-Id=APKAIPHBXWY2KT5RCMPQ",
                "canonical_url": "https://ssabrhelpdesk.freshservice.com/helpdesk/attachments/190672505306",
                "content_type": "application/pdf",
                "created_at": "2025-03-24T13:22:13Z",
                "has_access": true,
                "id": 19067505307,
                "name": "Doc2.pdf",
                "size": 82645,
                "updated_at": "2025-03-24T13:22:45Z"
            },
            {
                "attachment_url": "https://ssabrhelpdesk.attachments.freshservice.com/data/helpdesk/attachments/production/19067505306/original/tabela%20sap%20.pdf?response-content-type=application/pdf&Expires=1742913965&Signature=DhlWYfsEJSI1z6nRpeZhm8vREB~dn2xeFtGHPo-oQTIYPYZzd8GGeyFRVtzxDt1QzD6jUHkx7XaFNb7WSv4uJunJgXRW4R9HQxR6OXXWJudsovdTgHife9~rO~-iWT1s4kQIEbecZnQSzF4Y~QXIX0JlwOQXMyuWf5BNttriQxt-rCHHUJ5Q6tjoYdBJcs668a9rlDfRecLUEBS8iftKuonS2IuGU1kpKtdHL0qFvz5RrwmR47Ueh6PNFEv1crZPlXOMhxlLQW5YcOt~cvXRZrgvxk9sGT~LoH45h45Vy~3QV1IS8fubA2~vQIDe-WHoYbCOVYJrM2obiOr12kAlNg__&Key-Pair-Id=APKAIPHBXWY2KT5RCMPQ",
                "canonical_url": "https://ssabrhelpdesk.freshservice.com/helpdesk/attachments/19067505306",
                "content_type": "application/pdf",
                "created_at": "2025-03-24T13:22:13Z",
                "has_access": true,
                "id": 19067505306,
                "name": "Doc3.pdf",
                "size": 82645,
                "updated_at": "2025-03-24T13:22:45Z"
            },
            {
                "attachment_url": "https://ssabrhelpdesk.attachments.freshservice.com/data/helpdesk/attachments/production/190672505306/original/tabela%20sap%20.pdf?response-content-type=application/pdf&Expires=1742913965&Signature=DhlWYfsEJSI1z6nRpeZhm8vREB~dn2xeFtGHPo-oQTIYPYZzd8GGeyFRVtzxDt1QzD6jUHkx7XaFNb7WSv4uJunJgXRW4R9HQxR6OXXWJudsovdTgHife9~rO~-iWT1s4kQIEbecZnQSzF4Y~QXIX0JlwOQXMyuWf5BNttriQxt-rCHHUJ5Q6tjoYdBJcs668a9rlDfRecLUEBS8iftKuonS2IuGU1kpKtdHL0qFvz5RrwmR47Ueh6PNFEv1crZPlXOMhxlLQW5YcOt~cvXRZrgvxk9sGT~LoH45h45Vy~3QV1IS8fubA2~vQIDe-WHoYbCOVYJrM2obiOr12kAlNg__&Key-Pair-Id=APKAIPHBXWY2KT5RCMPQ",
                "canonical_url": "https://ssabrhelpdesk.freshservice.com/helpdesk/attachments/190672505306",
                "content_type": "application/pdf",
                "created_at": "2025-03-24T13:22:13Z",
                "has_access": true,
                "id": 19067505308,
                "name": "Doc4.pdf",
                "size": 82645,
                "updated_at": "2025-03-24T13:22:45Z"
            }
        ]
    };
}

function addEventListeners() {
    docForm.addEventListener('fwFormValueChanged', async ({ detail }) => {
        const { field, value } = detail;
        const container = document.getElementById('attachmentsSort');

        if (field === 'document_main_attachment') {
            container.innerHTML = '';

            if (value) {
                const filtered = context.data.attachments.filter(att => att.id !== value);
                const updatedChoices = buildChoicesFromAttachments(filtered);

                await docForm.setDisabledFields({ document_secondary_attachments: false });
                await docForm.setFieldChoices('document_secondary_attachments', updatedChoices);

                const mainAttachment = context.data.attachments.find(att => att.id === value);
                container.appendChild(createDragItem(mainAttachment, true));
            } else {
                await docForm.setDisabledFields({ document_secondary_attachments: true });
                await docForm.setFieldChoices('document_secondary_attachments', []);
            }
        }

        if (field === 'document_secondary_attachments') {
            const existingMain = container.querySelector('fw-drag-item[pinned="top"]');
            const secondaryValues = value || [];

            container.innerHTML = '';
            if (existingMain) container.appendChild(existingMain);

            secondaryValues.forEach(secName => {
                const attachment = context.data.attachments.find(att => att.name === secName);
                if (attachment) container.appendChild(createDragItem(attachment));
            });
        }
    });

    document.querySelector('#form-signatories-add').addEventListener('click', async (e) => {
        const { values, errors, isValid } = await signForm.doSubmit(e);
        console.log({ values, errors, isValid });

        if (isValid) {
            // Constrói a nova linha com os dados do formulário
            const newRow = {
                id: values.signatory_email,
                name: values.signatory_name,
                cpf: values.signatory_cpf,
                email: values.signatory_email,
                signatory_type: values.signatory_type,
                signature_type: values.signature_type
            };

            // Adiciona a nova linha à tabela
            signTable.rows = [...signTable.rows, newRow];
            console.log(signTable.rows)

            // Reseta o formulário após adicionar
            signForm.doReset(e);
        } else {
            // Aplica os erros visuais no formulário
            const formattedErrors = {};

            Object.entries(errors).forEach(([fieldName, message]) => {
                const fieldSchema = signForm.formSchema.fields.find(f => f.name === fieldName);
                formattedErrors[fieldName] = message || `${fieldSchema?.label || fieldName} é obrigatório.`;
            });

            signForm.setFieldErrors(formattedErrors);
        }
    });

    document.querySelector('#form-document-submit').addEventListener('click', async (e) => {
        const { values, isValid } = await docForm.doSubmit(e);
        console.log({ values, isValid });
        const errorNoSign = document.querySelector('#errorNoSign');
        if (isValid) {
            if (signTable.rows.length === 0) {
                await errorNoSign.show();
                return;
            }
            await errorNoSign.hide();
        }
    });


    document.querySelector('#form-document-reset').addEventListener('click', (e) => {
        docForm.doReset(e);
    });
}

async function buildDocumentForm() {
    const form = document.createElement('fw-form');

    const schema = {
        name: 'Document Form',
        fields: [
            {
                id: 'document_name',
                name: 'document_name',
                label: 'Nome do Contrato',
                type: 'TEXT',
                position: 1,
                required: true,
                placeholder: 'Insira o nome do contrato'
            },
            {
                id: 'document_main_attachment',
                name: 'document_main_attachment',
                label: 'Selecione o anexo principal',
                type: 'DROPDOWN',
                position: 2,
                required: true,
                placeholder: 'Adicione o arquivo principal do documento',
                choices: await buildChoicesFromAttachments(context.data.attachments)
            },
            {
                id: 'document_secondary_attachments',
                name: 'document_secondary_attachments',
                label: 'Selecione os anexos secundários',
                type: 'MULTI_SELECT',
                position: 3,
                required: true,
                placeholder: 'Os anexos serão adicionados na ordem em que forem selecionados',
                disabled: true,
                choices: []
            }
        ]
    };

    const initialValues = {
        document_name: `#REQ-${context.data.ticket_id} - Contrato de ${context.data.service_item_name} - SSA x `
    };

    const validationSchema = Yup.object().shape({
        document_name: Yup.string().required('Nome do contrato é obrigatório'),
        document_main_attachment: Yup.string().required('Anexo principal é obrigatório'),
        document_secondary_attachments: Yup.array()
            .min(1, 'Selecione ao menos um anexo secundário')
            .required('Anexos secundários são obrigatórios')
    });

    schema.fields = schema.fields.map(normalizeField);

    form.formSchema = schema;
    form.initialValues = initialValues;
    form.validationSchema = validationSchema;

    form.setDisabledFields({ document_secondary_attachments: true });

    return form;
}


function buildSignatariosForm() {
    const form = document.createElement('fw-form');

    const schema = {
        name: 'Signatarios Form',
        fields: [
            { id: 'signatory_name', name: 'signatory_name', label: 'Nome do Signatário', type: 'TEXT', required: true, placeholder: 'Insira o nome do signatário' },
            { id: 'signatory_cpf', name: 'signatory_cpf', label: 'CPF do Signatário', type: 'TEXT', required: true, placeholder: 'Insira o CPF do signatário' },
            { id: 'signatory_email', name: 'signatory_email', label: 'E-mail do Signatário', type: 'EMAIL', required: true, placeholder: 'Insira o e-mail do signatário' },
            {
                id: 'signatory_type',
                name: 'signatory_type',
                label: 'Tipo de signatário',
                type: 'DROPDOWN',
                required: true,
                placeholder: 'Selecione o tipo de signatário',
                choices: [
                    { id: "Aprovador", value: "Aprovador" },
                    { id: "Testemunha", value: "Testemunha" },
                    { id: "Representante", value: "Representante" },
                    { id: "Acusar Recebimento", value: "Acusar Recebimento" },
                    { id: "Observador", value: "Observador" }
                ]

            },
            {
                id: 'signature_type',
                name: 'signature_type',
                label: 'Tipo de Assinatura',
                type: 'DROPDOWN',
                required: true,
                placeholder: 'Selecione o tipo de assinatura',
                choices: [
                    { id: "Normal", value: "Normal" },
                    { id: "Certificado", value: "Certificado" },
                    { id: "Não aplicavel", value: "Não aplicavel" }
                ]

            },
            {
                id: 'signatory_order',
                name: 'signatory_order',
                label: 'Posição da assinatura',
                type: 'NUMBER',
                required: true,
                placeholder: 'Em qual ordem ele deve estar'
            }
        ]
    };

    const validationSchema = Yup.object().shape({
        signatory_name: Yup.string()
            .required('Nome do signatário é obrigatório'),

        signatory_cpf: Yup.string()
            .required('CPF é obrigatório')
            .test('valid-cpf-length', 'CPF deve conter 11 dígitos', value => {
                const digits = (value || '').replace(/\D/g, '');
                return digits.length === 11;
            }),

        signatory_email: Yup.string()
            .email('E-mail inválido')
            .required('E-mail é obrigatório'),

        signatory_type: Yup.string()
            .required('Tipo de signatário é obrigatório'),

        signature_type: Yup.string()
            .required('Tipo de assinatura é obrigatório'),

        signatory_order: Yup.number()
            .typeError('A posição deve ser um número')
            .required('A posição da assinatura é obrigatória')
            .integer('A posição deve ser um número inteiro')
            .min(1, 'A posição deve ser maior ou igual a 1'),
    });



    form.validationSchema = validationSchema;
    schema.fields = schema.fields.map(normalizeField);
    form.formSchema = schema;
    return form;
}

function normalizeField(field) {
    if (['DROPDOWN', 'MULTI_SELECT'].includes(field.type)) {
        field.choices = field.choices.map(choice => ({ ...choice, text: choice.value, value: choice.id }));
    }
    return field;
}

function buildSignatoryTable() {
    const data = {
        columns: [
            { key: "name", text: "Nome" },
            { key: "cpf", text: "CPF" },
            { key: "email", text: "E-mail" },
            { key: "signatory_type", text: "Tipo" },
            { key: "signature_type", text: "Assinatura" }
        ],
        rows: [
            {
                id: "0001",
                name: "Alexander Goodman",
                cpf: "751.314.213.23",
                email: "alexander@gmail.com",
                signatory_type: "Aprovador",
                signature_type: "Rúbrica"
            }
        ],
        rowActions: [
            {
                name: "Delete",
                handler: (rowData) => {
                    const table = document.querySelector('#datatable-signatories');
                    table.rows = table.rows.filter(row => row.id !== rowData.id);
                },
                hideForRowIds: ["0003"],
                iconName: "delete"
            }
        ]
    };

    const table = document.getElementById('datatable-signatories');
    table.columns = data.columns;
    table.rows = data.rows;
    table.rowActions = data.rowActions;

    return table
}

function buildChoicesFromAttachments(attachments) {
    return attachments.map(att => ({ id: att.id, value: att.name, text: att.name }));
}

function createDragItem(attachment, pinned = false) {
    const item = document.createElement('fw-drag-item');
    item.id = attachment.id;
    item.setAttribute('show-drag-icon', false);
    if (pinned) item.setAttribute('pinned', 'top');
    item.innerText = attachment.name;
    return item;
}

