import { GraphQLSchema, GraphQLResolveInfo } from 'graphql';
import gql from 'graphql-tag';
import { stitchSchemas } from '@graphql-tools/stitch';
import { delegateToSchema } from '@graphql-tools/delegate';

import ExampleServiceSubschemaConfig from './exampleService';
import RemoteServiceSubschemaConfig from './remoteService';

import { WrapQuery } from '@graphql-tools/wrap';

export default async (): Promise<GraphQLSchema> => {

	console.info('loading (remote) schemas…');
	const exampleSubschema = await ExampleServiceSubschemaConfig();
	const remoteSubschema = await RemoteServiceSubschemaConfig();

	const typeDefs = gql`

		extend type Query {
			article(id: ID!): Article
		}

		extend type Clip {
			customVideoUrl: String
		}

		type Article {
			id: ID!
			name: String
			clip: Clip
		}
	`;

	const mergedSchema = stitchSchemas({
		typeDefs,
		subschemas: [
			exampleSubschema,
			remoteSubschema,
		],
		resolvers: {
			Query: {
				article: () => ({__typename:"Article",id:'1234', name:"test"}),
			},
			Article: {
				clip: {
					resolve(_, { id }, context: any, info: GraphQLResolveInfo) {
						return delegateToSchema({
							schema: exampleSubschema,
							fieldName: 'viewer',
							context,
							info,
							transforms: [
								new WrapQuery(
									['viewer'],
									(subtree) => ({
										kind: 'Field',
										name: {
											kind: 'Name',
											value: 'clip',
										},
										arguments: [
											{
												kind: 'Argument',
												name: { kind: 'Name', value: 'id' },
												value: {
													kind: 'StringValue',
													value: '123',
												},
											},
										],
										selectionSet: subtree,
									}),
									(result) => {
										if (result?.clip) {
											return result.clip;
										}

										return null;
									}
								),
							],
						});
					},
				},
			},

			Clip: {
				customVideoUrl: () => "fooBar"
			},
		}
	});

	return mergedSchema;
}
