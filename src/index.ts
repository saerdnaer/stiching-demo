import { createServer } from "http";
import express from "express";
import cors from "cors";
import { ApolloServer } from "apollo-server-express";
import { GraphQLSchema } from "graphql";

import mergeSchemas from "./schema";
import config from "config";

const app = express();

async function run() {
	app.use("*", cors({ origin: "*" }));

	const port = config.get("port");
	const endpoint = process.env.SELF_URL_EXT || `http://localhost:${port}`;
	const graphqlPath = "/graphql";

	const schema: GraphQLSchema = await mergeSchemas();

	const apolloServer = new ApolloServer({
		schema,
		debug: true,
		introspection: true,
	});

	apolloServer.applyMiddleware({ app, path: graphqlPath });

	const server = createServer(app);
	server.listen(port, () => {
		console.info(`gateway running on ${endpoint}/graphql`);
	});
}
run();
