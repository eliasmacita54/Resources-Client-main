const LOGIN_API = "https://resources-main-7.onrender.com/login";
const SIGNUP_API = "https://resources-main-7.onrender.com/CriarCliente";
const SIGNUPRESOURCES_API = "https://resources-main-7.onrender.com/CriarRecursos";
const DELETE_RESOURCE_API = "https://resources-main-7.onrender.com/DeleteRecursos";
const RESOURCES_API = "https://resources-main-7.onrender.com/recursos";
const WEBSOCKET_URL = "https://resources-main-7.onrender.com/ws";

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
        alert("Falha no login: " + data.error);
        return;
      }
      jwtToken = data.token;
      userName = data.userName;
      userId = data.userId;
      console.log("Login bem-sucedido! Token:", jwtToken);

      localStorage.setItem('jwtToken', jwtToken);
      localStorage.setItem('userName', userName);
      localStorage.setItem('userId', userId);

      document.getElementById("user-name").textContent = `Bem-vindo, ${userName}!`;
      document.getElementById("login-signup-form").style.display = "none";
      document.getElementById("resource-list").style.display = "block";
      fetchResources();
      connectWebSocket();
    })
    .catch((error) => {
      console.error("Erro durante o login:", error);
      alert("Falha no login!");
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
        alert("Falha no registro: " + data.error);
        return;
      }
      alert("Registro bem-sucedido! Por favor, faça login.");
    })
    .catch((error) => {
      console.error("Erro durante o registro:", error);
      alert("Falha no registro!");
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
        console.error("Formato de recursos inválido:", recursos);
        alert("Falha no retorno de Recursos: Formato de recursos inválido");
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
        option.textContent = "Nenhum recurso reservado";
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
      console.error("Erro ao buscar recursos:", error);
      alert("Falha ao buscar recursos!");
    });
}

function reserveResource() {
  const resourceDropdown = document.getElementById("resources-dropdown");
  const resourceId = resourceDropdown.value;

  if (!resourceId) {
    alert("Por favor, selecione um recurso para reservar!");
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
          throw new Error(data.error || "Falha ao reservar o recurso");
        });
      }
      return response.json();
    })
    .then((data) => {
      alert("Recurso reservado com sucesso!");
      fetchResources();
      websocket.send(JSON.stringify({ action: "update" }));
    })
    .catch((error) => {
      console.error("Erro ao reservar recurso:", error);
      alert(error.message);
    });
}

function returnResource() {
  const reservedResourcesDropdown = document.getElementById("reserved-resources-dropdown");
  const resourceId = reservedResourcesDropdown.value;

  if (!resourceId) {
    alert("Por favor, selecione um recurso reservado para devolver!");
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
          throw new Error(data.error || "Falha ao devolver o recurso");
        });
      }
      return response.json();
    })
    .then((data) => {
      alert("Recurso devolvido com sucesso!");
      fetchResources();
      websocket.send(JSON.stringify({ action: "update" }));
    })
    .catch((error) => {
      console.error("Erro ao devolver recurso:", error);
      alert(error.message);
    });
}

function deleteResource() {
  const resourceDropdown = document.getElementById("reserved-resources-dropdown");
  const resourceId = resourceDropdown.value;

  if (!resourceId) {
    alert("Por favor, selecione um recurso para apagar!");
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
          const error = new Error(data.error || 'Erro ao apagar o recurso');
          error.details = data;
          throw error;
        });
      }
      return response.json();
    })
    .then(data => {
      alert("Recurso apagado com sucesso!");
      fetchResources();
      websocket.send(JSON.stringify({ action: "update" }));
    })
    .catch(error => {
      console.error("Erro ao apagar recurso:", error);
      alert(error.details ? error.details.message : "Erro ao apagar recurso");
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
          const error = new Error(data.error || 'Erro ao criar recurso');
          error.details = data;
          throw error;
        });
      }
      return response.json();
    })
    .then((data) => {
      alert("Recurso criado com sucesso!");
      fetchResources();
      websocket.send(JSON.stringify({ action: "update" }));
      document.getElementById("create-resource-form").reset();
    })
    .catch((error) => {
      console.error("Erro durante a criação do recurso:", error);
      alert(error.details ? error.details.error : "Erro durante a criação do recurso");
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
