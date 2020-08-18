import { GraphQLSchema, parseValue, GraphQLResolveInfo, printSchema } from 'graphql';
import gql from 'graphql-tag';
import 'apollo-cache-control';
import config from 'config';
import * as fs from 'fs';


import { LoadSchemaOptions } from '@graphql-tools/load';
import { UrlLoader, LoadFromUrlOptions } from '@graphql-tools/url-loader';
import { stitchSchemas } from '@graphql-tools/stitch';
import { RenameTypes, RenameRootFields, FilterRootFields } from '@graphql-tools/wrap';
import { delegateToSchema } from '@graphql-tools/delegate';

import MangoSubschemaConfig from './mango';
import { getColors } from './colors';

export default async (): Promise<GraphQLSchema> => {
	class Loader extends UrlLoader {
		async load(pointer: string, options: LoadFromUrlOptions) {
			console.info(` – import: ${pointer}`);
			return super.load(pointer, options);
		}
	};

	const options: LoadSchemaOptions = {
		loaders: [new Loader()],
		headers: {
			'user-agent': `stitching-demo (${config.get('branch')})`
		},
	}

	console.info('loading (remote) schemas…');
	const mango = await MangoSubschemaConfig(options);

	const radioExtensions = gql`

		extend type Query {
			audioBroadcastService(id: AudioBroadcastServiceId!): AudioBroadcastService
			audioBroadcastServices(
				after: String
				first: Int
				before: String
				last: Int
				filter: MangoBroadcastServiceFilter
				orderBy: MangoBroadcastServiceSortOrder
			): AudioBroadcastServiceConnection
		}

		scalar JSON

		enum AudioBroadcastServiceId {
			Bayern_1
			Bayern_2
			Bayern_3
			BR_Klassik
			B5_aktuell
			puls
			Bayern_plus
			BR_Heimat
		}

		interface AudioBroadcastService {
			id: ID!
			name: String
			description: String
			colors: JSON
			url: String
			epg(dayOffset: Int, day: Day, slots: [MangoEPGSlotKey]): [MangoEPGEntry]
		}

		type AudioBroadcastServiceConnection {
			count: Int
			nodes: [AudioBroadcastService!]
			pageInfo: MangoPageInfo
		}
		extend type MangoBroadcastService implements AudioBroadcastService {
			colors: JSON
			description: String
			url: String
		}

		directive @cacheControl(
			maxAge: Int,
			scope: CacheControlScope
		) on OBJECT | FIELD_DEFINITION

		enum CacheControlScope {
			PUBLIC
			PRIVATE
		}

	`;

	const computedProperties = ` `;

	const nodeInterface = gql`
		interface NodeInterface {
			id: ID!
			baseIdPrefix: String!
		}
		type NodeType implements NodeInterface & MangoNode {
			id: ID!
			baseIdPrefix: String!
		}
		union Node =
				NodeType
			| MangoCreativeWork
			| MangoProgramme
			| MangoBroadcastService

		extend type Query {
			node(id: ID!): Node
		}
	`;

	console.info('merging schemas…');
	const mergedSchema = stitchSchemas({
		typeDefs: [
			radioExtensions,
			nodeInterface
		],
		subschemas: [
			{
				...mango,
				transforms: [
					new RenameTypes((name: string) => `Mango${name}`, {
						renameBuiltins: false,
						renameScalars: false
					}),
					new FilterRootFields((operation, fieldName) => {
						if (operation === 'Query' && fieldName) {
							return [
								'broadcastService', 'allBroadcastServices', 'broadcastEvent',
								'programme', 'allProgrammes',
								'series', 'allSeries',
								'clip', 'image',
								'node', 'nodes', 'findInSophora',
								'id'].includes(fieldName)
						}
						return false;
					}),
					new RenameRootFields((operation, fieldName) => {
						if (operation === 'Query') {
							switch(fieldName) {
								case 'node':
									return 'mangoNode';
								case 'nodes':
									return 'mangoNodes';
								default:
									// transform allBroadcastServices to broadcastServices
									return fieldName.replace(/^all[A-Z]/, (x) => x[3].toLowerCase())
							}
						}
						return name;
					}),
				]
			}
		],
		mergeDirectives: true,
		resolvers: {
			Query: {
				node(parent: any, { id }: any, context: any, info: any) {
					// ids starting with av: are from Mango
					if (id.startsWith('av:')) {
						return delegateToSchema({
							schema: mango,
							fieldName: 'node',
							args: { id },
							context,
							info,
						});
					}
					// …
					// interprete everything else as Broadcast Service
					return delegateToSchema({
						schema: mango,
						fieldName: 'node',
						args: { id: `av:http://ard.de/ontologies/ard#${id}` },
						context,
						info,
					});
				},
				audioBroadcastService: {
					resolve(parent: any, { id }, context: any, info: GraphQLResolveInfo) {
						return delegateToSchema({
							schema: mango,
							fieldName: 'node',
							args: { id: `av:http://ard.de/ontologies/ard#${id}` },
							context,
							info,
							// transforms: [new WrapFieldsInFragment(weavedSchema, 'Node', 'AudioBroadcastService')],
						});
					},
				},
				audioBroadcastServices: {
					fragment: `... on AudioBroadcastService {
						id
					}`,
					resolve(parent: any, args: any, context: any, info: GraphQLResolveInfo) {
						const filter = parseValue('{ audioOnly: { eq: true } }');

						return delegateToSchema({
							schema: mango,
							operation: 'query',
							fieldName: 'broadcastServices', /*
							args: {
								...(args || {}),
								orderBy: parseValue('NAME_ASC'),
								filter
							}, */
							context,
							info,
						})?.then((results: any) => {
							console.log('result via delegateToSchema:', results);
							return results;
						});

						/*
						// TODO wrap fragment or use delegate to schema
						return queryClassicSchema(weavedSchema, {
							namespace: 'mango',
							fieldName: 'allBroadcastServices',
							args: {
								...(args || {}),
								orderBy: parseValue('NAME_ASC'),
								filter /* : {
									kind: 'ObjectValue',
									fields: [
										{
											kind: 'ObjectField',
											name: { kind: 'Name', value: 'audioOnly' },
											value: parseValue('{ eq: true }')
										},
										...(args?.filter?.fields || {}) // undefined is not a function
									]
								} * /,
							},
							context,
							info,
							// transforms: [new WrapConcreteTypes(weavedSchema, 'MangoBroadcastServiceInterface', 'AudioBroadcastService')],
						})*/


						// TODO
						return delegateToSchema({
							schema: mango,
							operation: 'query',
							fieldName: 'broadcastServices',
							args: {
								...(args || {}),
								orderBy: parseValue('NAME_ASC'),
								filter
							},
							context,
							info,
						}).then((results: any) => {
							return {
								...results,
								nodes: results.nodes.filter(
									// ignore B5 plus
									(x: any) => x.id !== 'av:http://ard.de/ontologies/ard#B5_plus'
								),
							};
						});
					},
				},
			},

			MangoBroadcastService: {
				colors: {
					fragment: `... on MangoBroadcastServiceInterface {
							id
						}`,
					resolve(broadcastService: any, { product }) {
						return getColors(broadcastService, product);
					},
				},

				/*
				epg: {
					resolve(broadcastService, args, context, info) {
						const { slots } = args;
						if (!broadcastService) {
							return null;
						}

						const epg = broadcastService.epg || broadcastService.currentEpg || broadcastService.current

						// do not cache unsucessful response from Mango
						if ( epg === null ) {
							console.warning('EPG was null!')
							info?.cacheControl?.setCacheHint({maxAge: 0})
							return null;
						}

						if ( slots && slots.includes('CURRENT') ) {
							info?.cacheControl?.setCacheHint({maxAge: 7})
						}

						return broadcastService.epg || broadcastService.currentEpg || broadcastService.current
					}
				}, */

			},
		}
	});

	const sdl = printSchema(mergedSchema);
	await fs.writeFile(__dirname + '/mergedSchema.graphql', sdl, () => {});


	// adding second layer for properties which depend on new attributes from first layer
	console.info('adding computed properties…');
	return stitchSchemas({
		schemas: [mergedSchema, computedProperties],
		mergeDirectives: true,
		resolvers: {
			// …
		},
	});
}
