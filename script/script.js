const LOGIN_API = "http://localhost:3000/login";
const SIGNUP_API = "http://localhost:3000/CriarCliente";
const SIGNUPRESOURCES_API = "http://localhost:3000/CriarRecursos";
const DELETE_RESOURCE_API = "http://localhost:3000/DeleteRecursos";
const RESOURCES_API = "http://localhost:3000/recursos";
const WEBSOCKET_URL = "http://localhost:3000/ws";
const HISTORY_API = "http://localhost:3000/historico"

let jwtToken = null;
let userName = null;
let userId = null;
let websocket;
let heartbeatInterval;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const WEBSOCKET_RECONNECT_INTERVAL = 5000; // 5 seconds

window.onload = () => {
  const storedToken = localStorage.getItem('jwtToken');
  const storedUserName = localStorage.getItem('userName');
  const storedUserId = localStorage.getItem('userId');

  if (storedToken && storedUserName && storedUserId) {
    jwtToken = storedToken;
    userName = storedUserName;
    userId = storedUserId;

    document.getElementById("user-name").textContent = `Bem-vindo, ${userName}!`;
    document.getElementById("login-signup-form").style.display = "none";
    document.getElementById("resource-list").style.display = "block";

    fetchResources();
    fetchHistory();
    connectWebSocket();
  } else {
    document.getElementById("login-signup-form").style.display = "block";
    document.getElementById("resource-list").style.display = "none";
  }

  document.getElementById("login-form").onsubmit = handleLogin;
  document.getElementById("signup-form").onsubmit = handleSignup;
  document.getElementById("create-resource-form").onsubmit = createResource;
  document.getElementById("reserve-button").onclick = reserveResource;
  document.getElementById("delete-button").onclick = deleteResource;
  document.getElementById("return-button").onclick = returnResource;
  document.getElementById("logout-button").onclick = handleLogout;
};

function fetchHistory() {
  fetch(HISTORY_API, {
    headers: { Authorization: `Bearer ${jwtToken}` },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        alert(data.error);
        return;
      }
      populateHistory(data.historico);
    })
    .catch((error) => {
      console.error("Error fetching history:", error);
      alert("Failed to fetch history");
    });
}
function populateHistory(history) {
  const historyTableBody = document.getElementById("history-entries");
  historyTableBody.innerHTML = "";

  history.forEach((entry) => {
    const row = document.createElement("tr");


    const userCell = document.createElement("td");
    userCell.textContent = entry.cliente ? entry.cliente.nome : "N/A"; // Incluindo o nome do usuário
    row.appendChild(userCell);

    const resourceCell = document.createElement("td");
    resourceCell.textContent = entry.recurso ? entry.recurso.nome : "N/A"; // Incluindo o nome do recurso
    row.appendChild(resourceCell);

    const actionCell = document.createElement("td");
    actionCell.textContent = entry.operacao || "N/A"; // Incluindo a operação
    row.appendChild(actionCell);

    
    const dateCell = document.createElement("td");
    dateCell.textContent = entry.dataHora || "N/A"; // Incluindo a data/hora
    row.appendChild(dateCell);

    historyTableBody.appendChild(row);
  });
}


function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const loginData = { email: email, password };

  fetch(LOGIN_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loginData),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        alert("Login failed: " + data.error);
        return;
      }
      jwtToken = data.token;
      userName = data.userName;
      userId = data.userId;
      console.log("Login successful! Token:", jwtToken);

      localStorage.setItem('jwtToken', jwtToken);
      localStorage.setItem('userName', userName);
      localStorage.setItem('userId', userId);

      document.getElementById("user-name").textContent = `Bem-vindo, ${userName}!`;
      document.getElementById("login-signup-form").style.display = "none";
      document.getElementById("resource-list").style.display = "block";
      fetchResources();
      fetchHistory();
      connectWebSocket();
    })
    .catch((error) => {
      console.error("Error during login:", error);
      alert("Login failed!");
    });
}

function handleSignup(event) {
  event.preventDefault();
  const username = document.getElementById("signup-username").value;
  const password = document.getElementById("signup-password").value;
  const email = document.getElementById("signup-email").value;

  const signupData = { nome: username, password, email };

  fetch(SIGNUP_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signupData),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        alert("Signup failed: " + data.error);
        return;
      }
      alert("Signup successful! Please log in.");
    })
    .catch((error) => {
      console.error("Error during signup:", error);
      alert("Signup failed!");
    });
}

function fetchResources() {
  fetch(RESOURCES_API, {
    headers: { Authorization: `Bearer ${jwtToken}` },
  })
    .then((response) => response.json())
    .then((data) => {
      const recursos = data.recursos;
      const resourceDropdown = document.getElementById("resources-dropdown");
      const reservedResourcesDropdown = document.getElementById("reserved-resources-dropdown");
      resourceDropdown.innerHTML = "";
      reservedResourcesDropdown.innerHTML = "";

      if (!recursos || !Array.isArray(recursos)) {
        console.error("Invalid resources format:", recursos);
        alert("Failed to fetch resources: Invalid resources format");
        return;
      }

      const availableResources = recursos.filter((resource) => resource.disponivel);
      const reservedResources = recursos.filter((resource) => resource.reservaId === userId);

      availableResources.forEach((resource) => {
        const option = document.createElement("option");
        option.value = resource.id;
        option.textContent = resource.nome;
        resourceDropdown.appendChild(option);
      });

      if (reservedResources.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No reserved resources";
        reservedResourcesDropdown.appendChild(option);
        document.getElementById("return-button").disabled = true;
      } else {
        document.getElementById("return-button").disabled = false;
        reservedResources.forEach((resource) => {
          const option = document.createElement("option");
          option.value = resource.id;
          option.textContent = resource.nome;
          reservedResourcesDropdown.appendChild(option);
        });
      }
    })
    .catch((error) => {
      console.error("Error fetching resources:", error);
      alert("Failed to fetch resources!");
    });
}

function reserveResource() {
  const resourceDropdown = document.getElementById("resources-dropdown");
  const resourceId = resourceDropdown.value;

  if (!resourceId) {
    alert("Please select a resource to reserve!");
    return;
  }

  fetch(`${RESOURCES_API}/${resourceId}/reservar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
    },
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((data) => {
          console.error("Server response:", data);
          throw new Error(data.error || "Failed to reserve resource");
        });
      }
      return response.json();
    })
    .then((data) => {
      alert("Resource reserved successfully!");
      fetchResources();
      websocket.send(JSON.stringify({ action: "update" }));
    })
    .catch((error) => {
      console.error("Error reserving resource:", error);
      alert(error.message);
    });
}

function returnResource() {
  const reservedResourcesDropdown = document.getElementById("reserved-resources-dropdown");
  const resourceId = reservedResourcesDropdown.value;

  if (!resourceId) {
    alert("Please select a reserved resource to return!");
    return;
  }

  fetch(`${RESOURCES_API}/${resourceId}/devolver`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
    },
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((data) => {
          console.error("Server response:", data);
          throw new Error(data.error || "Failed to return resource");
        });
      }
      return response.json();
    })
    .then((data) => {
      alert("Resource returned successfully!");
      fetchResources();
      websocket.send(JSON.stringify({ action: "update" }));
    })
    .catch((error) => {
      console.error("Error returning resource:", error);
      alert(error.message);
    });
}

function deleteResource() {
  const resourceDropdown = document.getElementById("reserved-resources-dropdown");
  const resourceId = resourceDropdown.value;

  if (!resourceId) {
    alert("Please select a resource to delete!");
    return;
  }

  fetch(`${DELETE_RESOURCE_API}/${resourceId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
    },
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then(data => {
          const error = new Error(data.error || 'Failed to delete resource');
          error.details = data;
          throw error;
        });
      }
      return response.json();
    })
    .then(data => {
      alert("Resource deleted successfully!");
      fetchResources();
      websocket.send(JSON.stringify({ action: "update" }));
    })
    .catch(error => {
      console.error("Error deleting resource:", error);
      alert(error.details ? error.details.message : "Failed to delete resource");
    });
}
function createResource(event) {
  event.preventDefault();
  const resourceName = document.getElementById("resource-name").value;

  const resourceData = { nome: resourceName };

  fetch(SIGNUPRESOURCES_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
    },
    body: JSON.stringify(resourceData),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then(data => {
          const error = new Error(data.error || 'Failed to create resource');
          error.details = data;
          throw error;
        });
      }
      return response.json();
    })
    .then((data) => {
      alert("Resource created successfully!");
      fetchResources();
      websocket.send(JSON.stringify({ action: "update" }));
      document.getElementById("create-resource-form").reset();
    })
    .catch((error) => {
      console.error("Error creating resource:", error);
      alert(error.details ? error.details.error : "Failed to create resource");
    });
}


function handleLogout() {
  jwtToken = null;
  userName = null;
  userId = null;
  localStorage.removeItem('jwtToken');
  localStorage.removeItem('userName');
  localStorage.removeItem('userId');
  document.getElementById("login-signup-form").style.display = "block";
  document.getElementById("resource-list").style.display = "none";
  if (websocket) {
    websocket.close();
  }
  clearInterval(heartbeatInterval);
}

function connectWebSocket() {
  websocket = new WebSocket(WEBSOCKET_URL);

  websocket.onopen = () => {
    console.log("WebSocket connected!");
    sendHeartbeat();
    heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
  };

  websocket.onmessage = (event) => {
    console.log("WebSocket message received:", event.data);
    fetchResources();
    fetchHistory();
  };

  websocket.onclose = () => {
    console.log("WebSocket connection closed. Attempting to reconnect...");
    clearInterval(heartbeatInterval);
    setTimeout(connectWebSocket, WEBSOCKET_RECONNECT_INTERVAL);
  };

  websocket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

function sendHeartbeat() {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({ action: "heartbeat" }));
  }
}
