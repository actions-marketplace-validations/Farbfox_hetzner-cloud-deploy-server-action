// @format
const test = require("ava");
const createWorker = require("expressively-mocked-fetch");
const proxyquire = require("proxyquire");

const { assignIP } = require("../lib.js");

test("if a request creates a server on Hetzner Cloud", async (t) => {
  const hetznerServerMock = await createWorker(`
    app.get("/", async (req, res) => {
      return res.status(200).send()
    });
  `);
  const worker = await createWorker(`
    app.post("/servers", (req, res) => {
      if (req.body.name &&
          req.body.server_type &&
          req.body.image &&
          req.body.ssh_keys.length > 0) {
        return res.status(201).send({server: {id: 124, public_net: { ipv4: { ip: "localhost" } }}});
      } else {
        return res.status(422).send();
      }
    });
  `);

  const options = {
    server: {
      name: "server",
      type: "cx11",
    },
    image: {
      type: "",
      name: "ubuntu-20.04",
    },
    sshKeyName: "abc",
    hcloudToken: "def",
    timeout: 10000,
  };

  let serverIdSet = false;
  let serverIPSet = false;
  const { deploy } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`,
      DEFAULT_PORT: hetznerServerMock.port,
    },
    "@actions/core": {
      getInput: (name) => {
        switch (name) {
          case "startup-timeout":
            return options.timeout;
          case "server-name":
            return options.server.name;
          case "server-type":
            return options.server.type;
          case "server-location":
            return options.server.location;
          case "image-identifier":
            return options.image.name;
          case "image-label":
              return options.image.label;
          case "image-type":
            return options.image.type;
          case "ssh-key-name":
            return options.sshKeyName;
          case "hcloud-token":
            return options.hcloudToken;
          default:
            throw new Error("didn't match possible cases");
        }
      },
      setFailed: console.error,
      setOutput: () => {},
      exportVariable: (name) => {
        if (name === "SERVER_ID") serverIdSet = true;
        if (name === "SERVER_IPV4") serverIPSet = true;
      },
    },
  });

  const res = await deploy();
  t.assert(res.url.includes("localhost"));
  t.assert(res.status === 201);
  t.true(serverIdSet);
  t.true(serverIPSet);
});

test("if a server can be deleted in cleanup ", async (t) => {
  const options = {
    server: {
      name: "server",
      type: "cx11",
    },
    image: {
      type: "",
      name: "ubuntu-20.04",
    },
    sshKeyName: "abc",
    hcloudToken: "def",
    timeout: 10000,
  };
  const worker = await createWorker(`
    app.delete("/servers/:id", (req, res) => {
      if (req.params.id) {
        return res.status(200).send(); 
      } else {
        return res.status(400).send();
      }
    });
  `);

  const { clean } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`,
    },
    "@actions/core": {
      getInput: (name) => {
        switch (name) {
          case "startup-timeout":
            return options.timeout;
          case "delete-server":
            // NOTE: core.getInput always returns strings.
            return "true";
          case "server-name":
            return options.server.name;
          case "server-type":
            return options.server.type;
          case "server-location":
            return options.server.location;
          case "image-identifier":
            return options.image.name;
          case "image-label":
            return options.image.label;
          case "image-type":
            return options.image.type;
          case "ssh-key-name":
            return options.sshKeyName;
          case "hcloud-token":
            return options.hcloudToken;
          case "server-id":
            return 123;
          default:
            throw new Error("didn't match possible cases");
        }
      },
      setFailed: console.error,
      setOutput: () => {},
    },
  });
  const res = await clean();
  t.assert(res.url.includes("localhost"));
  t.assert(res.status === 200);
});

test("if a server is kept when delete-server input is set to false", async (t) => {
  const options = {
    server: {
      name: "server",
      type: "cx11",
    },
    image: {
      type: "",
      name: "ubuntu-20.04",
    },
    sshKeyName: "abc",
    hcloudToken: "def",
    timeout: 10000,
  };
  const worker = await createWorker(`
    app.delete("/servers/:id", (req, res) => {
      return res.status(400).send();
    });
  `);

  const { clean } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`,
    },
    "@actions/core": {
      getInput: (name) => {
        switch (name) {
          case "startup-timeout":
            return options.timeout;
          case "delete-server":
            // NOTE: core.getInput always returns strings
            return "false";
          case "server-name":
            return options.server.name;
          case "server-type":
            return options.server.type;
          case "server-location":
            return options.server.location;
          case "image-identifier":
            return options.image.name;
          case "image-label":
            return options.image.label;
          case "image-type":
            return options.image.type;
          case "ssh-key-name":
            return options.sshKeyName;
          case "hcloud-token":
            return options.hcloudToken;
          case "server-id":
            return 123;
          default:
            throw new Error("didn't match possible cases");
        }
      },
      setFailed: console.error,
      setOutput: () => {},
    },
  });
  const res = await clean();
  t.assert(!res);
});

test("if assigning an IP fails inputs that are not a number", async (t) => {
  const floatingIPId = "hello world";
  const { assignIP } = proxyquire("../lib.js", {
    "cross-fetch": () => t.fail(),
    "@actions/core": {
      getInput: (name) => {
        switch (name) {
          case "floating-ip-id":
            return floatingIPId;
          default:
            return "mock value";
        }
      },
      setFailed: () => t.pass(),
    },
  });

  await assignIP();
});

test("if non-assigned floating-ip-id stops assigning procedure silently", async (t) => {
  const floatingIPId = undefined;
  const { assignIP } = proxyquire("../lib.js", {
    "cross-fetch": () => t.fail(),
    "@actions/core": {
      getInput: (name) => {
        switch (name) {
          case "floating-ip-id":
            return floatingIPId;
          default:
            return "mock value";
        }
      },
      setFailed: () => t.fail(),
    },
  });

  await assignIP();
  t.pass();
});

test("if assigning a floating IP to a server is possible", async (t) => {
  const floatingIPId = 1337;
  const floatingIP = "127.0.0.1";
  const SERVER_ID = 1234;
  const hcloudToken = "abc";
  const IPAssignmentTimeout = 10000;

  const worker = await createWorker(
    `
    const actionId = 4321;
    app.post("/floating_ips/:floatingIPId/actions/assign", (req, res) => {
      if (typeof req.body.server === "number") {
        return res.status(201).json({
          action: {
            id: actionId
          }
        });
      } else {
        return res.status(400).send();
      }
    });

    let c = 0;
    app.get("/floating_ips/:floatingIPId/actions/:actionId", (req, res) => {
      if (c === 0) {
        res.status(200).json({
          action: {
            id: actionId,
            status: "running"
          }
        });
      } else if (c === 1) {
        res.status(200).json({
          action: {
            id: actionId,
            status: "success"
          }
        });
      }

      c++;
      return;
    });

    app.get("/floating_ips/:floatingIPId", (req, res) => {
      return res.status(200).json({
        floating_ip: {
          ip: "${floatingIP}"
        }
      });
    });
  `,
    { requestCount: 4 }
  );

  const { assignIP } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`,
    },
    process: {
      env: {
        SERVER_ID,
      },
    },
    "@actions/core": {
      getInput: (name) => {
        switch (name) {
          case "floating-ip-id":
            return floatingIPId;
          case "hcloud-token":
            return hcloudToken;
          case "floating-ip-assignment-timeout":
            return IPAssignmentTimeout;
          default:
            return "mock value";
        }
      },
      setFailed: () => t.fail(),
      exportVariable: (name, val) => {
        t.assert(name === "SERVER_FLOATING_IPV4");
        t.assert(val === floatingIP);
      },
    },
  });

  const res = await assignIP();
  t.pass();
});

test("getting the status of assigning a floating IP", async (t) => {
  const worker = await createWorker(`
    const actionId = 4321;
    app.get("/floating_ips/:floatingIPId/actions/:actionId", (req, res) => {
      return res.status(200).json({
        action: {
          id: actionId,
          status: "success"
        }
      });
    });
  `);
  const { getAssignmentProgress } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`,
    },
  });

  const status = await getAssignmentProgress(1234, 4321)();
  t.assert(status === "success");
});

test("getting a floating ip", async (t) => {
  const ip = "127.0.0.1";
  const worker = await createWorker(`
    app.get("/floating_ips/:floatingIPId", (req, res) => {
      return res.status(200).json({
        floating_ip: {
          ip: "${ip}"
        }
      });
    });
  `);
  const { getFloatingIP } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`,
    },
  });

  t.assert((await getFloatingIP(1234)) === ip);
});

test("if appropriate errors are thrown when assigning IP fails", async (t) => {
  const floatingIPId = 1337;
  const floatingIP = "127.0.0.1";
  const SERVER_ID = 1234;
  const hcloudToken = "abc";
  const IPAssignmentTimeout = 2000;

  const worker = await createWorker(
    `
    const actionId = 4321;
    app.post("/floating_ips/:floatingIPId/actions/assign", (req, res) => {
      if (typeof req.body.server === "number") {
        return res.status(201).json({
          action: {
            id: actionId
          }
        });
      } else {
        return res.status(400).send();
      }
    });

    app.get("/floating_ips/:floatingIPId/actions/:actionId", (req, res) => {
      res.status(200).json({
        action: {
          id: actionId,
          status: "error"
        }
      });
    });

    app.get("/floating_ips/:floatingIPId", (req, res) => {
      return res.status(200).json({
        floating_ip: {
          ip: "${floatingIP}"
        }
      });
    });
  `,
    { requestCount: 4 }
  );

  const { assignIP } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`,
    },
    process: {
      env: {
        SERVER_ID,
      },
    },
    "@actions/core": {
      getInput: (name) => {
        switch (name) {
          case "floating-ip-id":
            return floatingIPId;
          case "hcloud-token":
            return hcloudToken;
          case "floating-ip-assignment-timeout":
            return IPAssignmentTimeout;
          default:
            return "mock value";
        }
      },
      setFailed: () => t.pass(),
      exportVariable: (name, val) => {
        t.assert(name === "SERVER_FLOATING_IPV4");
        t.assert(val === floatingIP);
      },
    },
  });

  const res = await assignIP();
});

test("getting an image id from snapshot", async (t) => {
  const worker = await createWorker(`
    app.get('/images', function (req, res) {
      res.status(200).json({
        images: [
          {id: "23", description: "", type: "backup"},
          {id: "24", description: "", type: "system"},
          {id: "25", description: "snapshot3", type: "snapshot"},
          {id: "26", description: "snapshot4", type: "snapshot"},
          {id: "27", description: "snapshot5", type: "snapshot"}
        ]
      });
    });
  `,
    { requestCount: 2 }
  );

  const { getImageId } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`,
    },
    "@actions/core": {
      getInput: (name) => {
        switch (name) {
          case "image-type":
            return "snapshot";
        }
      },
    },
  });

  let imageId = await getImageId("snapshot3");
  t.assert(imageId === "25");
  imageId = await getImageId("snapshot4");
  t.assert(imageId === "26");
});

test("getting an image id from snapshot with label", async (t) => {
  const worker = await createWorker(`
    app.get('/images', function (req, res) {
      res.status(200).json({
        images: [
          {id: "23", description: "", type: "backup"},
          {id: "24", description: "", type: "system"},
          {id: "25", description: "snapshot3", type: "snapshot"},
          {id: "26", description: "snapshot4", type: "snapshot"},
          {id: "27", description: "snapshot5", type: "snapshot", labels: { "GITHUB": ""}},
          {id: "28", description: "snapshot6", type: "snapshot"}
        ]
      });
    });
  `,
    { requestCount: 2 }
  );

  const { getImageId } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`,
    },
    "@actions/core": {
      getInput: (name) => {
        switch (name) {
          case "image-label":
            return "GITHUB";
          case "image-type":
            return "snapshot";
        }
      },
    },
  });
  
  imageId = await getImageId("snapshot3");
  t.assert(imageId === "25");
  imageId = await getImageId("snapshot5");
  t.assert(imageId === "27");
});

test("if a request creates a server on Hetzner Cloud from snapshot", async (t) => {
  const hetznerServerMock = await createWorker(`
      app.get("/", async (req, res) => {
        return res.status(200).send()
      });
    `);
  const worker = await createWorker(`
      app.post("/servers", (req, res) => {
        if (req.body.name &&
            req.body.server_type &&
            req.body.image &&
            req.body.ssh_keys.length > 0) {
          return res.status(201).send({server: {id: 124, public_net: { ipv4: { ip: "localhost" } }}});
        } else {
          return res.status(422).send();
        }
      });

      app.get('/images', function (req, res) {
        res.status(200).json({
          images: [
            {id: "23", description: "", type: "backup"},
            {id: "24", description: "", type: "system"},
            {id: "25", description: "snapshot3", type: "snapshot"},
            {id: "26", description: "snapshot4", type: "snapshot"},
            {id: "27", description: "snapshot5", type: "snapshot"}
          ]
        });
      });
    `,
      { requestCount: 2 }
    );

  const options = {
    server: {
      name: "server",
      type: "cx11",
    },
    image: {
      type: "snapshot",
      name: "snapshot3",
    },
    sshKeyName: "abc",
    hcloudToken: "def",
    timeout: 10000,
  };

  let serverIdSet = false;
  let serverIPSet = false;
  const { deploy } = proxyquire("../lib.js", {
    "./config.js": {
      API: `http://localhost:${worker.port}`,
      DEFAULT_PORT: hetznerServerMock.port,
    },
    "@actions/core": {
      getInput: (name) => {
        switch (name) {
          case "startup-timeout":
            return options.timeout;
          case "server-name":
            return options.server.name;
          case "server-type":
            return options.server.type;
          case "server-location":
            return options.server.location;
          case "image-identifier":
            return options.image.name;
          case "image-label":
            return options.image.label;
          case "image-type":
            return options.image.type;
          case "ssh-key-name":
            return options.sshKeyName;
          case "hcloud-token":
            return options.hcloudToken;
          default:
            throw new Error("didn't match possible cases");
        }
      },
      setFailed: console.error,
      setOutput: () => {},
      exportVariable: (name) => {
        if (name === "SERVER_ID") serverIdSet = true;
        if (name === "SERVER_IPV4") serverIPSet = true;
      },
    },
  });

  const res = await deploy();
  t.assert(res.url.includes("localhost"));
  t.assert(res.status === 201);
  t.true(serverIdSet);
  t.true(serverIPSet);
});

// test("try live run", async (t) => {
// INFO: set options explicitly to use this for live test with hentzner cloud
//   const { deploy } = proxyquire("../lib.js", {
//     "./config.js": {
//     },
//   });
//   const res = await deploy();
//   t.assert(true);
// });
