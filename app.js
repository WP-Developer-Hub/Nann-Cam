$(document).ready(() => {
    const $myIdEl = $("#my-id");
    const $usernameInput = $("#username-input");
    const $genderInput = $("#gender-input");
    const $roleInput = $("#role-input");
    const $ageInput = $("#age-input");
    const $avatarInput = $("#avatar-input");

    const $usernameEl = $("#username");
    const $roleEl = $("#role");
    const $avatarEl = $("#avatar");

    const $slaveVideo = $("#slaveVideo");
    const $slaveControls = $("#slave-controls");
    const $viewerControls = $("#viewer-controls");
    const $mainControl = $("#main-control");

    const $micGain = $("#micGain");
    const $micMeter = $("#micMeter");
    const $muteBtn = $("#muteBtn");

    const $otherIdInput = $("#other-id");
    const $remoteVolume = $("#remoteVolume");
    const $remoteMuteBtn = $("#remoteMuteBtn");

    const $chatBox = $("#chat-box");
    const $chatInput = $("#chat-input");

    const $modal = $("#user-setup-modal");

    let peer = new Peer();
    let localStream = null;
    let micTrack = null;
    let conn = null;
    let currentCall = null;
    let incomingCall = null;

    peer.on("open", id => {
    $myIdEl.text(id);
    let gender = null;
    const userInfoStr = localStorage.getItem("userInfo");
    if (userInfoStr) {
      try {
        const userInfo = JSON.parse(userInfoStr);
        gender = userInfo.gender;
      } catch {}
      $modal.hide();
    }

    if (!gender) {
      gender = $genderInput.val();
    }

    if (gender !== "Man") {
      getLocalStream();
    } else {
      appendMessage("Daddy view only. No mic/cam active.", "System");
    }

    });


    async function getLocalStream() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      micTrack = localStream.getAudioTracks()[0];
      $slaveVideo[0].srcObject = localStream;
      setupAudioAnalysis(localStream);
    } catch (err) {
      appendMessage("Could not get media: " + err.message, "System");
    }
    }

    function saveUserInfo() {
    const username = $usernameInput.val().trim();
    const gender = $genderInput.val();
    const role = $roleInput.val();
    const age = parseInt($ageInput.val(), 10);
    const avatarFile = $avatarInput[0].files[0];

    if (!username || !gender || !role || isNaN(age)) {
      appendMessage("Please fill all fields", "System");
      return;
    }
    if (age < 18) {
      appendMessage("Must be 18+", "System");
      return;
    }

    let avatarURL = "https://i.pravatar.cc/40?u=default";
    if (avatarFile) avatarURL = URL.createObjectURL(avatarFile);

    localStorage.setItem("userInfo", JSON.stringify({ username, gender, role, avatar: avatarURL }));

    $modal.hide();
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

    $usernameEl.text(data.username || "");
    $roleEl.text(data.role || "");
    $avatarEl.attr("src", data.avatar || "https://i.pravatar.cc/40?u=default");
    }

    function handleGenderChange() {
    if ($genderInput.val() === "Man") {
      $roleInput.val("Daddy");
      $roleInput.prop("disabled", true);
    } else {
      $roleInput.prop("disabled", false);
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

    $micGain.on("input", e => {
      gainNode.gain.value = parseFloat(e.target.value);
    });

    function updateMeter() {
      if (!$micMeter.length) return;
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buffer);
      const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length / 255;
      $micMeter.val(avg);
      requestAnimationFrame(updateMeter);
    }
    updateMeter();
    }

    function toggleMute() {
    if (!localStream || !micTrack) return;
    micTrack.enabled = !micTrack.enabled;

    const $icon = $muteBtn.find("i");
    if ($icon.length) {
      $icon.attr("class", micTrack.enabled ? "fa-solid fa-microphone" : "fa-solid fa-microphone-slash");
    }
    }

    function toggleRemoteMute() {
    if (!$slaveVideo.length) return;
    $slaveVideo[0].muted = !$slaveVideo[0].muted;

    const $icon = $remoteMuteBtn.find("i");
    if ($icon.length) {
      $icon.attr("class", $slaveVideo[0].muted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high");
    }
    }

    function appendMessage(text, sender = "You") {
    if (!$chatBox.length) return;
    const $msgDiv = $("<div>").addClass("mb-1");
    const $senderSpan = $("<span>").text(sender + ": ").css({ "font-weight": "bold", color: sender === "You" ? "#a5b4fc" : "#facc15" });
    const $textSpan = $("<span>").text(text);
    $msgDiv.append($senderSpan, $textSpan);
    $chatBox.append($msgDiv);
    $chatBox.scrollTop($chatBox.prop("scrollHeight"));
    }

    function sendMessage() {
    const message = $chatInput.val().trim();
    if (!message) return;
    if (!conn?.open) {
      appendMessage("Not connected", "System");
      return;
    }
    appendMessage(message, "You");
    conn.send(message);
    $chatInput.val("");
    }

    function setupDataConnection(connection) {
    connection.on("open", () => {
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
      const { username, gender, role } = userInfo;
      const greeting = gender === "Man"
        ? `Slave ${username} connected. Awaiting commands.`
        : `${role} ${username} is in control.`;

      connection.send(greeting);
      appendMessage("Chat connected", "System");
    });

    connection.on("data", data => {
      appendMessage(data, "Peer");
    });

    connection.on("close", () => {
      appendMessage("Chat disconnected", "System");
    });

    connection.on("error", err => {
      appendMessage("Chat error: " + err, "System");
    });
    }

    peer.on("connection", incoming => {
    conn = incoming;
    setupDataConnection(conn);
    });


    peer.on("call", call => {
      incomingCall = call; // ✅ Assign incomingCall so it can be answered manually if desired

      const gender = JSON.parse(localStorage.getItem("userInfo") || "{}").gender;
      if (gender === "Man") {
        appendMessage("Slave is calling. Accepting for viewing...", "System");

        call.answer(); // Viewer answers with no stream

        call.on("stream", remoteStream => {
          $slaveVideo[0].srcObject = remoteStream;
          appendMessage("Viewing live stream", "System");
        });

        currentCall = call;
      } else {
        appendMessage("Incoming call. Click 'Answer Call' to accept.", "System");
      }
    });

    $("#connect-btn").on("click", () => {
    const remoteId = $otherIdInput.val().trim();
    if (!remoteId) return appendMessage("Enter a valid ID", "System");

    conn = peer.connect(remoteId);
    setupDataConnection(conn);

    const gender = JSON.parse(localStorage.getItem("userInfo") || "{}").gender;
    if (gender !== "Man") {
      const call = peer.call(remoteId, localStream);
      currentCall = call;
      appendMessage("Calling Daddy...", "System");
    }
    });

    $("#send-btn").on("click", sendMessage);
    $chatInput.on("keypress", e => { if (e.which === 13) sendMessage(); });
    $muteBtn.on("click", toggleMute);
    $remoteMuteBtn.on("click", toggleRemoteMute);
    $genderInput.on("change", handleGenderChange);
    $("#save-user-btn").on("click", saveUserInfo);
    $("#start-call-btn").on("click", () => {
      const remoteId = $otherIdInput.val().trim();
      if (!remoteId) return appendMessage("Enter a valid ID", "System");

      if (!localStream) {
        appendMessage("No media stream available", "System");
        return;
      }

      const call = peer.call(remoteId, localStream);
      currentCall = call;
      appendMessage("Calling peer...", "System");

      call.on("stream", remoteStream => {
        $slaveVideo[0].srcObject = remoteStream;
        appendMessage("Receiving video stream", "System");
      });

      call.on("close", () => {
        appendMessage("Call ended", "System");
      });

      call.on("error", err => {
        appendMessage("Call error: " + err.message, "System");
      });
    });

    $("#answer-call-btn").on("click", () => {
        if (!incomingCall) {
          appendMessage("No call to answer", "System");
          return;
        }

        const gender = JSON.parse(localStorage.getItem("userInfo") || "{}").gender;
        if (gender === "Man") {
          incomingCall.answer(); // Viewer answers with no stream
        } else {
          if (!localStream) {
            appendMessage("No media stream available", "System");
            return;
          }
          incomingCall.answer(localStream); // Slave answers with stream
        }

        appendMessage("Call answered", "System");

        incomingCall.on("stream", remoteStream => {
          $slaveVideo[0].srcObject = remoteStream;
          appendMessage("Receiving video stream", "System");
        });

        incomingCall.on("close", () => {
          appendMessage("Call ended", "System");
        });

        incomingCall.on("error", err => {
          appendMessage("Call error: " + err.message, "System");
        });

        currentCall = incomingCall;
        incomingCall = null; // Clear after answering
      });

    updateUserInfo();
});
