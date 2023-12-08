import routes from "./routes";

async function app(
  instance,
  opts,
  done
) {
  instance.get("/", async (req, res) => {
    res.status(200).send({
      hello: "World",
    });
  });
  instance.register(routes, { prefix: "/api/v1" });
  done();
}

export default app;