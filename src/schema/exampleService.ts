import * as fs from 'fs';
import { printSchema } from "graphql";
import gql from "graphql-tag";

import { SubschemaConfig } from "@graphql-tools/delegate";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { stitchSchemas } from "@graphql-tools/stitch";
import { FilterTypes, RenameTypes, FilterRootFields } from "@graphql-tools/wrap";


const typeDefs = gql`
	interface Node {
		id: ID!
	}

	interface ItemInterface {
		id: ID!
		name: String
	}

	type Item implements Node & ItemInterface {
		id: ID!
		name: String
	}

	type Query {
		node(id: ID!): Node
		viewer: Viewer
	}
	type Viewer {
		item(id: ID!): ItemInterface
	}
`;

const ITEM = {
	__typename: "Item",
	id: "123",
	name: "Foo bar 42",
};

const resolvers = {
	Query: {
		node: () => ITEM,
	},
	Viewer: {
		item: () => {
			console.log('item resolver was called')
			return ITEM;
		}
	},
};

export default async (): Promise<SubschemaConfig> => {
	const classicSchema = makeExecutableSchema({
		typeDefs,
		resolvers,
	});


	const schema = stitchSchemas({
		subschemas: [
			{
				schema: classicSchema,
				transforms: [
					new FilterTypes(type => {
						return type.name !== 'Query'
					}),
					new RenameTypes((name: string) => {
						switch (name) {
							case 'Viewer':
								return 'Query';
							default:
								return name;
						}
					}),
					new FilterRootFields(operation => operation === 'Query'),
				]
			}
		],
		//mergeTypes: false
	});

	const sdl = printSchema(schema);
	await fs.writeFile(__dirname + '/transformedSchema.graphql', sdl, () => {});

	return {
		schema,
	};
};
