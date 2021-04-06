import { GraphQLSchema, GraphQLResolveInfo } from 'graphql';
import gql from 'graphql-tag';
import { stitchSchemas } from '@graphql-tools/stitch';
import { delegateToSchema } from '@graphql-tools/delegate';

import ExampleServiceSubschemaConfig from './exampleService';
import PlaylistSubschemaConfig from './playlistService';
import audioElement from './audioelements';


export default async (): Promise<GraphQLSchema> => {

	console.info('loading (remote) schemas…');
	const exampleSubschema = await ExampleServiceSubschemaConfig();
	const playlistSubschema = await PlaylistSubschemaConfig();

	const typeDefs = gql`

		extend type Query {
			coloredItem(id: ID!): ColoredItem
		}

		interface ColoredItem {
			id: ID!
			name: String
			color: String
		}

		extend type Item implements ColoredItem {
			color: String
		}
	`;

	const mergedSchema = stitchSchemas({
		typeDefs: [
			audioElement.typeDefs,
			typeDefs
		],
		subschemas: [
			exampleSubschema,
			playlistSubschema,
		],
		mergeDirectives: true,
		resolvers: {
			Query: {
				coloredItem: {
					resolve(_, { id }, context: any, info: GraphQLResolveInfo) {
						return delegateToSchema({
							schema: exampleSubschema,
							fieldName: 'item',
							args: { id: id },
							context,
							info,
						});
					},
				},
			},

			Item: {
				color: () => "#000"
			},
		}
	});

	console.info('adding computed properties…');
	const productSchema = stitchSchemas({
		subschemas: [ mergedSchema ],
		typeDefs: [ ],
		mergeDirectives: true,
		resolvers: {
		}
	});

	return productSchema;
}
