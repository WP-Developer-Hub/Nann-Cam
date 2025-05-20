document.addEventListener('DOMContentLoaded', () => {
  let peer = new Peer();
  let localStream = null;
  let micTrack = null;
  let conn = null;

  peer.on("open", id => {
    const myIdEl = document.getElementById("my-id");
    if (myIdEl) myIdEl.textContent = id;
  });

  function saveUserInfo() {
    const usernameInput = document.getElementById("username-input");
    const genderInput = document.getElementById("gender-input");
    const roleInput = document.getElementById("role-input");
    const ageInput = document.getElementById("age-input");
    const avatarInput = document.getElementById("avatar-input");

    if (!usernameInput || !genderInput || !roleInput || !ageInput || !avatarInput) {
      alert("User input elements missing");
      return;
    }

    const username = usernameInput.value.trim();
    const gender = genderInput.value;
    const role = roleInput.value;
    const age = parseInt(ageInput.value, 10);
    const avatarFile = avatarInput.files[0];

    if (!username || !gender || !role || isNaN(age)) {
      alert("Please fill all fields correctly");
      return;
    }
    if (age < 18) {
      alert("You must be 18 or older");
      return;
    }

    let avatarURL = "https://i.pravatar.cc/40?u=default";
    if (avatarFile) avatarURL = URL.createObjectURL(avatarFile);

    localStorage.setItem("userInfo", JSON.stringify({ username, gender, role, avatar: avatarURL }));

    const modal = document.getElementById("user-setup-modal");
    if (modal) modal.style.display = "none";

    updateUserInfo();
  }

  function updateUserInfo() {
    const dataStr = localStorage.getItem("userInfo");
    if (!dataStr) return;

    let data;
    try {
      data = JSON.parse(dataStr);
    } catch {
      return;
    }

    const usernameEl = document.getElementById("username");
    const roleEl = document.getElementById("role");
    const avatarEl = document.getElementById("avatar");

    if (usernameEl) usernameEl.textContent = data.username || "";
    if (roleEl) roleEl.textContent = data.role || "";
    if (avatarEl) avatarEl.src = data.avatar || "https://i.pravatar.cc/40?u=default";
  }

  function handleGenderChange() {
    const genderInput = document.getElementById("gender-input");
    const roleInput = document.getElementById("role-input");
    if (!genderInput || !roleInput) return;

    if (genderInput.value === "Man") {
      roleInput.value = "Daddy";
      roleInput.disabled = true;
    } else {
      roleInput.disabled = false;
    }
  }

  async function startBroadcast() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream = stream;
      micTrack = stream.getAudioTracks()[0];

      const slaveVideo = document.getElementById("slaveVideo");
      if (slaveVideo) slaveVideo.srcObject = stream;

      document.getElementById("slave-controls")?.classList.remove("hidden");
      document.getElementById("viewer-controls")?.classList.add("hidden");
      document.getElementById("main-control")?.classList.add("hidden");

      peer.on("call", call => {
        call.answer(stream);
      });

      setupAudioAnalysis(stream);
    } catch (e) {
      alert("Could not start broadcast: " + e.message);
    }
  }

  function setupAudioAnalysis(stream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const gainNode = audioContext.createGain();
    const analyser = audioContext.createAnalyser();

    source.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(audioContext.destination);

    const micGain = document.getElementById("micGain");
    if (micGain) {
      micGain.oninput = e => gainNode.gain.value = parseFloat(e.target.value);
    }

    const micMeter = document.getElementById("micMeter");
    function updateMeter() {
      if (!analyser || !micMeter) return;
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buffer);
      const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length / 255;
      micMeter.value = avg;
      requestAnimationFrame(updateMeter);
    }
    updateMeter();
  }

  function toggleMute() {
    if (!localStream || !micTrack) return;
    micTrack.enabled = !micTrack.enabled;

    const muteBtn = document.getElementById("muteBtn");
    const icon = muteBtn?.querySelector("i");
    if (icon) icon.className = micTrack.enabled ? "fa-solid fa-microphone" : "fa-solid fa-microphone-slash";
  }

  async function startViewing() {
    const otherIdInput = document.getElementById("other-id");
    if (!otherIdInput) return alert("Other ID input not found");
    const otherId = otherIdInput.value.trim();
    if (!otherId) return alert("Enter an ID to connect to");

    if (!localStream) {
      try {
        await startBroadcast();
      } catch (e) {
        return;
      }
    }

    const call = peer.call(otherId, localStream);
    if (!call) return alert("Failed to call peer");

    document.getElementById("viewer-controls")?.classList.remove("hidden");
    document.getElementById("slave-controls")?.classList.add("hidden");
    document.getElementById("main-control")?.classList.add("hidden");

    call.on("stream", stream => {
      const video = document.getElementById("slaveVideo");
      if (!video) return;

      video.srcObject = stream;
      const volumeSlider = document.getElementById("remoteVolume");
      if (volumeSlider) {
        video.volume = parseFloat(volumeSlider.value) || 1;
        volumeSlider.oninput = () => video.volume = parseFloat(volumeSlider.value) || 1;
      }
    });

    conn = peer.connect(otherId);
    setupDataConnection(conn, true);
  }

  function toggleRemoteMute() {
    const video = document.getElementById("slaveVideo");
    if (!video) return;

    video.muted = !video.muted;
    const icon = document.getElementById("remoteMuteBtn")?.querySelector("i");
    if (icon) icon.className = video.muted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
  }

  function appendMessage(text, sender = "You") {
    const chatBox = document.getElementById("chat-box");
    if (!chatBox) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = "mb-1";

    const senderSpan = document.createElement("span");
    senderSpan.textContent = sender + ": ";
    senderSpan.style.fontWeight = "bold";
    senderSpan.style.color = sender === "You" ? "#a5b4fc" : "#facc15";

    const textSpan = document.createElement("span");
    textSpan.textContent = text;

    msgDiv.appendChild(senderSpan);
    msgDiv.appendChild(textSpan);

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function sendMessage() {
    const input = document.getElementById("chat-input");
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;
    if (!conn?.open) {
      appendMessage("Connection not established. Please connect first.", "System");
      return;
    }
    appendMessage(message, "You");
    conn.send(message);
    input.value = "";
  }

  function setupDataConnection(connection, isOutgoing = false) {
    if (!connection) return;

    connection.on("open", () => {
      const data = JSON.parse(localStorage.getItem("userInfo") || "{}");
      const { gender, role, username } = data;
      let message = "Connected.";

      if (gender === "Man") {
        message = `connections to ${gender} slave ${username} was successfully. You are now in control.`;
      } else {
        message = `${role} ${username} is now in control of you.`;
      }

      connection.send(message);
      appendMessage("Chat connection opened.", "System");
    });

    connection.on("data", data => {
      appendMessage(data, "Peer");
    });

    connection.on("close", () => {
      appendMessage("Chat connection closed.", "System");
    });

    connection.on("error", err => {
      appendMessage("Chat error: " + err, "System");
    });
  }

  peer.on("connection", connection => {
    conn = connection;
    setupDataConnection(conn);
  });

  const chatInput = document.getElementById("chat-input");
  if (chatInput) {
    chatInput.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  window.saveUserInfo = saveUserInfo;
  window.handleGenderChange = handleGenderChange;
  window.startBroadcast = startBroadcast;
  window.toggleMute = toggleMute;
  window.startViewing = startViewing;
  window.toggleRemoteMute = toggleRemoteMute;

  const userInfo = localStorage.getItem("userInfo");
  const modal = document.getElementById("user-setup-modal");

  if (!userInfo && modal) {
    modal.style.display = "block";
  } else {
    modal.style.display = "none";
    updateUserInfo();
  }

  window.addEventListener("click", event => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
});
