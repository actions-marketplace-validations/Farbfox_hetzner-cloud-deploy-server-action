// @format
const core = require("@actions/core");
const fetch = require("cross-fetch");

const config = require("./config.js");

const options = {
  server: {
    name: core.getInput("server-name"),
    image: core.getInput("server-image"),
    type: core.getInput("server-type")
  },
  sshKeyName: core.getInput("ssh-key-name"),
  hcloudToken: core.getInput("hcloud-token")
};

async function deploy() {
  let res;
  try {
    res = await fetch(`${config.API}/servers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.hcloudToken}`
      },
      body: JSON.stringify({
        name: options.server.name,
        image: options.server.image,
        server_type: options.server.type,
        ssh_keys: [options.sshKeyName]
      })
    });
  } catch (err) {
    core.setFailed(err.message);
  }

  if (res.status === 201) {
    console.log("Hetzner Cloud Server deployment successful");
    const body = await res.json();
    core.setOutput("server-id", body.server.id);
    return res;
  } else {
    core.setFailed(
      `When sending the request to Hetzner's API, an error occurred "${
        res.statusText
      }"`
    );
  }
}

async function clean() {
  let res;
  try {
    res = await fetch(`${config.API}/servers/${core.getInput("server-id")}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.hcloudToken}`
      }
    });
  } catch (err) {
    core.setFailed(err.message);
  }

  if (res.status === 201) {
    console.log("Hetzner Cloud Server deleted in clean up routine");
    return res;
  } else {
    core.setFailed(
      `When sending the request to Hetzner's API, an error occurred "${
        res.statusText
      }"`
    );
  }
}

module.exports = {
  deploy,
  clean
};
