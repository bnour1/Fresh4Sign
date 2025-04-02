let client;

init();

async function init() {
  client = await app.initialized();
  client.events.on('app.activated', renderText);

  addEventListeners();
}

function addEventListeners() {
  const newDocumentButton = document.getElementById('newDocumentButton');
  if (newDocumentButton) {
    newDocumentButton.addEventListener('fwClick', openModal);
  } else {
    console.warn('Botão com id newDocumentButton não encontrado');
  }
}

function openModal() {
  try {
    const data = client.interface.trigger('showModal', {
      title: 'Novo Contrato',
      template: 'views/modal.html',
      data: { contratoId: 123 }
    });
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

function renderText() {
  console.log("APP CARREGADOW")
}
