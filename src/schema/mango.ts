import { print, GraphQLSchema, printSchema } from 'graphql';
import gql from 'graphql-tag';
import { fetch } from 'cross-fetch';
import config from 'config';
import * as fs from 'fs';

import { introspectSchema, RenameTypes, FilterRootFields, wrapSchema, FilterTypes, FilterInterfaceFields } from '@graphql-tools/wrap';
import { Executor, SubschemaConfig } from '@graphql-tools/delegate';
import { LoadSchemaOptions, loadSchema } from '@graphql-tools/load';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { IFieldResolverOptions, IResolvers } from '@graphql-tools/utils';

import { stitchSchemas } from '@graphql-tools/stitch';

const mangoUrl = process.env.MANGO_URL || 'https://api.mediathek.br.de/graphql';


/*
This module should transform the relay classic endpoint from mangoUrl to a modern schema without edges and viewer,
with some addional shortcuts.

To be more concrete: The following schema should be transformted to $targetSchema (see variable below)

schema {
	query: RootQuery
	…
}

type RootQuery {
	node(id: ID!): Node
	nodes(ids: [ID]!): [Node]
	viewer: Viewer
}

type Viewer implementes Node {
	broadcastServices(after: String, first: Int, before: String, last: Int, filter: BroadcastServiceFilter, orderBy: BroadcastServiceSortOrder): BroadcastServiceConnection
	broadcastService(id: ID!): BroadcastServiceInterface
	broadcastEvent(id: ID!): BroadcastEventInterface
	…
}

*/

const targetSchema = `
schema {
  query: Query
}

type Query {
  node(id: ID!): Node
  nodes(ids: [ID]!): [Node]

  broadcastServices(after: String, first: Int, before: String, last: Int, filter: BroadcastServiceFilter, orderBy: BroadcastServiceSortOrder): BroadcastServiceConnection
  broadcastService(id: ID!): BroadcastServiceInterface
  broadcastEvent(id: ID!): BroadcastEventInterface

}`;

const mangoCwTypes = ['CreativeWork', 'BestOf', 'Board', 'Extra',
'Item', 'MakingOf', 'Playlist', 'Programme', 'Season', 'Series',
'Clip', 'Trailer', 'WebPage', 'Grouping' ];


const typeDefs = gql`

extend interface ImageInterface {
	url: String
}
extend type Image {
	url: String
}
extend interface CreativeWorkInterface {
	url: String
}
${mangoCwTypes.map(x => `extend type ${x} { url: String }`).join('\n')}
`;


const url: IFieldResolverOptions = {
	fragment: `... on ThingWithCanonicalUrl {
		canonicalUrl
	}`,
	resolve(item: any) {
		return item?.canonicalUrl;
	}
};

const resolvers: IResolvers = {
	Image: {
		url: {
			fragment: `... on ImageInterface {
					imageFiles {
						nodes {
							publicLocation
						}
					}
				}`,
			resolve(image) {
				if (image?.imageFiles?.nodes?.length > 0) {
					return image.imageFiles?.nodes[0].publicLocation;
				}
				return null;
			},
		},
	},
	CreativeWorkInterface: { url },
	// repeat url resolver definiation for all other Mango Types implementing CreativeWorkInterface
	...mangoCwTypes.reduce((acc, x) => ({ ...acc, [x]: { url } }), {}),
};

const executor: Executor = async ({ document, variables, context }) => {
	const { req } = context as any || { req: null};
	let query = print(document);
	let wrapped = false;
	// hack to wrap request into viewer...
	if ( query[0] === '{' ) {
		query = `{\nviewer ${query}}`
		wrapped = true;
		console.debug(query);
	}

	const fetchResult = await fetch(mangoUrl, {
		method: 'POST',
		headers: {
			...req?.headers || {},
			'Content-Type': 'application/json',
			'user-agent': `stiching-demo (${config.get('branch')})`,
		},
		body: JSON.stringify({ query, variables }),
	});
	const result = await fetchResult.json();
	if ( wrapped ) {
		return {
			...result,
			data: result.data.viewer
		}
	}
	return result;
};


export default async (options: LoadSchemaOptions): Promise<SubschemaConfig> => {
	console.info(` – import: ${mangoUrl}`);

	const mangoSchema = await introspectSchema(executor);

	// const newRootQuery = await loadSchema(targetSchema, options);
	/*const mergedSchema = mergeSchemas({
		schemas: [
			mangoSchema,
		],
		typeDefs: [
			targetSchema,
			typeDefs
		],
		resolvers
	});?*/

	const schema = stitchSchemas({
		subschemas: [
			{
				schema: mangoSchema,
				transforms: [
					new FilterTypes(type => {
						return type.name !== 'RootQuery'
						&& !type.name.includes('Payload')
						&& !type.name.includes('Input')
						&& !type.name.includes('FeatureMap')
						&& !type.name.includes('Subscription')
						&& !type.name.includes('Subject')
						&& !type.name.includes('Geo')
						&& !type.name.includes('Genre')
						&& !type.name.includes('Agent')
						&& !type.name.includes('Account')
						&& !type.name.includes('Audience')
						&& !type.name.includes('Availability')
						&& !type.name.includes('Categor')
						&& !type.name.includes('Edge')
					}),
					new RenameTypes((name: string) => {
						switch (name) {
							case 'RootQuery':
								return 'ClassicRootQuery';
							case 'Viewer':
								return 'Query';
							case 'DateTime':
								return 'Datetime';
							default:
								return name;
						}
					}),
					new FilterRootFields(operation => operation === 'Query'),
					new FilterInterfaceFields((typeName, fieldName) => {
						if (typeName === 'Node') {
							// Node interface should only consist of id
							if(fieldName === 'baseIdPrefix') {
								// console.debug('removing baseIdPrefix from MangoNode')
								return false;
							};
						}
						return true;
					}),
				]
			}
		],
		typeDefs: [
			typeDefs,
			`schema {
				query: Query
			}`
		],
		resolvers,
		//mergeTypes: false
	});

	if ( config.get('isDevelopment') ) {
		const sdl = printSchema(schema);
		await fs.writeFile(__dirname + '/mangoSchema.graphql', sdl, () => {});
	}

	return {
		schema,
		executor,
	};
};
