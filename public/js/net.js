const Net = (() => {
  const TOKEN_KEY = "ldr_token";
  let socket = null;
  let playerId = null;
  const handlers = {};

  function on(ev, fn) {
    handlers[ev] = fn;
  }

  function emit(ev, data) {
    if (socket && socket.connected) socket.emit(ev, data);
  }

  function connect() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    socket = io({ auth: { token } });

    window.addEventListener("pagehide", () => {
      try {
        if (socket && socket.connected) socket.disconnect();
      } catch (_) {}
    });

    socket.on("connect", () => {
      if (handlers.connect) handlers.connect();
    });
    socket.on("disconnect", () => {
      if (handlers.lost) handlers.lost();
    });
    socket.on("serverFull", () => {
      if (handlers.full) handlers.full();
    });
    socket.on("joined", (data) => {
      playerId = data.playerId;
      sessionStorage.setItem(TOKEN_KEY, data.token);
      if (handlers.joined) handlers.joined(data);
    });
    socket.on("state", (state) => {
      if (handlers.state) handlers.state(state);
    });
    socket.on("notice", (msg) => {
      if (handlers.notice) handlers.notice(msg);
    });
  }

  return {
    connect,
    on,
    emit,
    get playerId() {
      return playerId;
    },
  };
})();
