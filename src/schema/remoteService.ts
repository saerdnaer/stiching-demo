import * as fs from 'fs';
import { print, printSchema } from 'graphql';
import { fetch } from 'cross-fetch';

import { SubschemaConfig } from "@graphql-tools/delegate";
import { introspectSchema, wrapSchema } from '@graphql-tools/wrap';
import { LoadSchemaOptions, loadSchema } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { AsyncExecutor } from '@graphql-tools/utils';


export default async (): Promise<SubschemaConfig> => {
	const name = 'playlist';
	const schemaFile = `${__dirname}/generated/${name}Schema.graphql`;
	const endpointUrl = process.env.REMOTE_URL || 'https://localhost:5001/graphql';
	const debug = (process.env.DEBUG)?.includes(name.toUpperCase());
	const fastStart = true;

	const executor: AsyncExecutor = async ({ document, variables, context }) => {
		const { req } = context as any || { req: null};
		let query = print(document);
		if ( debug ) {
			console.debug(query);
		}

		const fetchResult = await fetch(endpointUrl, {
			method: 'POST',
			headers: {
				...req?.headers || {},
				'Content-Type': 'application/json',
				'user-agent': `test-gateway (foo)`,
			},
			body: JSON.stringify({ query, variables }),
		});
		const result = await fetchResult.json();
		if ( debug ) {
			console.dir(result, { depth: 3 });
		}
		return result;
	};


	console.info(` – import: ${endpointUrl} (from ${fastStart ? 'local snapshot' : 'remote'})`);

	// TODO: generate schema during build time in cluster, not only locally?

	const schema = wrapSchema({
		schema: await (fastStart
			// fastStart: load prebuild schema from disk
			? loadSchema(schemaFile, { loaders: [ new GraphQLFileLoader() ] })
			// else: build schema on the fly, and store result to disk
			: introspectSchema(executor)

		),
		executor
	});

	if (!fastStart) {
		const schemaSdl = printSchema(schema);
		fs.writeFile(schemaFile, schemaSdl, () => { });
	}

	return  { schema };
};
