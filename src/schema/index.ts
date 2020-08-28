import { GraphQLSchema, GraphQLResolveInfo } from 'graphql';
import gql from 'graphql-tag';
import { stitchSchemas } from '@graphql-tools/stitch';
import { delegateToSchema } from '@graphql-tools/delegate';

import ExampleServiceSubschemaConfig from './exampleService';

export default async (): Promise<GraphQLSchema> => {

	console.info('loading (remote) schemas…');
	const exampleSubschema = await ExampleServiceSubschemaConfig();

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
		typeDefs,
		subschemas: [
			{
				...exampleSubschema,
			}
		],
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

	return mergedSchema;
}
