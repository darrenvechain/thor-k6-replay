import { scenario } from "k6/execution";
import { SharedArray } from "k6/data";
import { sleep, check } from "k6";
import http from "k6/http";

const data = new SharedArray("users", function () {
  const httpRequestsRaw = open("../data/http_requests.log");
  const reqs = httpRequestsRaw.split("\n");

  while (reqs[reqs.length - 1].trim() === "") {
    reqs.pop();
  }

  return reqs;
});

const firstRequest = JSON.parse(data[0]);
const baseUrl = __ENV.BASE_URL || "http://localhost:8669";

const sleepUntilStart = (request) => {
  const firstRequestNanoSeconds = firstRequest.start_time;
  const currentRequestNanoSeconds = request.start_time;

  const sleepTime =
    (currentRequestNanoSeconds - firstRequestNanoSeconds) / 1000000;

  const sleepInSeconds = sleepTime / 1000;

  sleep(sleepInSeconds);
};

export const options = {
  scenarios: {
    ramping_vus: {
      executor: "ramping-vus",
      startVUs: 50000,
      stages: [{ duration: "1h", target: 50000 }],
    },
  },
};

export default function () {
  if (scenario.iterationInTest >= data.length) {
    sleep(36000);
    return;
  }

  const rawRequest = data[scenario.iterationInTest];
  const request = JSON.parse(rawRequest);

  sleepUntilStart(request);

  if (scenario.iterationInTest == data.length - 1) {
    console.log("Making the final request....");
    return;
  }

  const url = `${baseUrl}${request.url}`;

  let res;

  if (request.method === "GET") {
    res = http.get(url);
  } else {
    res = http.post(url, request.request_body);
  }

  check(res, {
    "is status 200": (r) => r.status === 200,
  });
}
