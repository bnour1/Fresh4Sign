function uploadToD4sign({ domain, token, crypt, uuid, fileStream, filename, endpoint }) {
    const FormData = require('form-data');
    const axios = require('axios');

    const form = new FormData();
    form.append('file', fileStream, { filename });

    return axios.post(
        `https://${domain}/api/v1/documents/${uuid}/${endpoint}`,
        form,
        {
            headers: { ...form.getHeaders() },
            params: {
                tokenAPI: token,
                cryptKey: crypt
            }
        }
    ).then(res => res.data);
}

exports = {
    uploadAttachmentToD4sign: async function (args) {
        const { d4sign_uuid_safe, d4sign_domain, d4sign_token, d4sign_crypt } = args.iparams;
        const { attachment_url, name } = args;

        try {
            const axios = require('axios');
            const { data: fileBuffer } = await axios.get(attachment_url, { responseType: 'arraybuffer' });

            const data = await uploadToD4sign({
                domain: d4sign_domain,
                token: d4sign_token,
                crypt: d4sign_crypt,
                uuid: d4sign_uuid_safe,
                fileStream: fileBuffer,
                filename: name,
                endpoint: 'upload'
            });

            renderData(null, {
                message: 'Principal enviado',
                uuid: data.uuid
            });
        } catch (e) {
            console.log(e)
            renderData({ status: 500, message: e.message });
        }
    },

    uploadSecondaryAttachmentToD4sign: async function (args) {
        const { d4sign_domain, d4sign_token, d4sign_crypt } = args.iparams;
        const { attachment_url, name, uuid_document } = args;

        try {
            const axios = require('axios');
            const { data: fileStream } = await axios.get(attachment_url, { responseType: 'stream' });

            const data = await uploadToD4sign({
                domain: d4sign_domain,
                token: d4sign_token,
                crypt: d4sign_crypt,
                uuid: uuid_document,
                fileStream,
                filename: name,
                endpoint: 'uploadslave'
            });

            renderData(null, {
                message: `Secundário "${name}" enviado`,
                response: data
            });
        } catch (e) {
            renderData({ status: 500, message: e.message });
        }
    },
    onAppInstallHandler: async function () {
        const url = await generateTargetUrl()
        console.log(url)
        renderData()
    },
    onExternalEventHandler: function (payload) {
        console.log("Logging arguments from the event:" + JSON.stringify(payload));
        renderData()
    }

};
