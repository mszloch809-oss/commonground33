let store = {
  lastId: 1000,
  workOrders: {}
};

function createWorkOrder(data) {
  const id = "WO-" + (++store.lastId);

  store.workOrders[id] = {
    id,
    status: "OPEN",
    createdAt: new Date().toISOString(),
    tenantPhone: data.tenantPhone,
    vendorPhone: data.vendorPhone,
    address: data.address,
    unit: data.unit,
    issue: data.issue,
    messages: []
  };

  return store.workOrders[id];
}

function getWorkOrder(id) {
  return store.workOrders[id];
}

function addMessage(id, message) {
  if (store.workOrders[id]) {
    store.workOrders[id].messages.push({
      ...message,
      time: new Date().toISOString()
    });
  }
}

function updateStatus(id, status) {
  if (store.workOrders[id]) {
    store.workOrders[id].status = status;
  }
}

module.exports = {
  createWorkOrder,
  getWorkOrder,
  addMessage,
  updateStatus
}; 
