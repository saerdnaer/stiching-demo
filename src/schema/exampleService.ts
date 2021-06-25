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

	interface ClipInterface {
		id: ID!
		name: String
	}

	type Clip implements Node & ClipInterface {
		id: ID!
		name: String
	}

	type Query {
		node(id: ID!): Node
		viewer: Viewer
	}
	type Viewer {
		clip(id: ID!): ClipInterface
	}
`;

const CLIP = {
	__typename: "Clip",
	id: "123",
	name: "Foo bar 42",
};

const resolvers = {
	Query: {
		node: () => CLIP,
	},
	Viewer: {
		clip: () => {
			console.log('clip resolver was called')
			return CLIP;
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
			}
		],
		//mergeTypes: false
	});

	const sdl = printSchema(schema);
	await fs.writeFile(__dirname + '/transformedSchema.graphql', sdl, () => {});

	return {
		schema: classicSchema,
	};
};
