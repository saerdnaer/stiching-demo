import { createServer } from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import { execute, subscribe, GraphQLSchema } from 'graphql';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { RedisCache } from 'apollo-server-cache-redis';
import { InMemoryLRUCache } from 'apollo-server-caching';

import { graphiqlExpress } from './handlers/graphiql';

import mergeSchemas from './schema';
import config from 'config';


const app = express();

async function run() {

	app.use('*', cors({ origin: '*' }));
	app.use('/_lbhealth', (_, res: Response) => res.json({ status: 'OK' }));

	app.use(function handleError(err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) {
		res.json({
			error: err.message,
		});
	});

	const port = config.get('port');
	const endpoint = process.env.SELF_URL_EXT || `http://localhost:${port}`;
	const graphqlPath = '/graphql';
	const externalURL = `${endpoint}/graphql`;
	const subscriptionsEndpoint = `${endpoint.replace('http', 'ws')}/subscriptions`;

	const schema: GraphQLSchema = await mergeSchemas();

	const playgroundOptions: any = config.get('env') !== 'master'
		? {
				endpoint: externalURL,
				subscriptionEndpoint: subscriptionsEndpoint,
				settings: {
					// Force setting, workaround: https://github.com/prisma/graphql-playground/issues/790
					'editor.theme': 'dark',
					'editor.cursorShape': 'line', // possible values: 'line', 'block', 'underline'
					'request.credentials': 'same-origin',
					'schema.polling.interval': 200,
				},
				shareEnabled: true,
		  }
		: false;

	let apqCache: InMemoryLRUCache | RedisCache;
	if (config.get('apq.cacheEngine') === 'in-memory') {
		apqCache = new InMemoryLRUCache();
	} else if (config.get('apq.cacheEngine') === 'redis') {
		apqCache = new RedisCache({
			...config.get('redis'),
			keyPrefix: 'APQ_',
		});
	} else {
		console.error(`invalid apq cache engine obtained: ${config.get('apq.cacheEngine')}`);
		process.exit(1);
	}

	// see https://www.apollographql.com/docs/apollo-server/api/apollo-server.html
	const apolloServer = new ApolloServer({
		schema,
		debug: config.get('isDevelopment') || config.get('env') === 'dev',
		introspection: true,
		// tracing: config.get('isDevelopment') || config.get('env') === 'dev',
		playground: playgroundOptions,
		persistedQueries: {
			cache: apqCache,
			ttl: config.get('apq.ttl'),
		},
		// redis cache in gateway
		cache: config.get('isDevelopment') ? undefined : new RedisCache(config.get('redis')),
		// http cache (cdn provider)
		cacheControl: {
			defaultMaxAge: 60, // seconds
		}
	});

	app.use('/graphiql', graphiqlExpress({ endpointURL: externalURL, subscriptionsEndpoint }));
	apolloServer.applyMiddleware({ app, path: graphqlPath });

	const server = createServer(app);
	server.listen(port, () => {
		console.info(`gateway running on ${endpoint}/graphql`);
		console.info(`graphiql IDE with example query is at ${endpoint}/graphiql`);


		// eslint-disable-next-line no-new
		new SubscriptionServer({ execute, subscribe, schema }, { server, path: '/subscriptions' });
	});
}
run();
