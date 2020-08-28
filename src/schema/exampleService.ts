import { SubschemaConfig } from "@graphql-tools/delegate";
import { makeExecutableSchema } from "@graphql-tools/schema";
import gql from "graphql-tag";

const typeDefs = gql`
	interface ItemInterface {
		id: ID!
		name: String
	}

	type Item implements ItemInterface {
		id: ID!
		name: String
	}

	type Query {
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
		item: () => ITEM,
	},
};

export default async (): Promise<SubschemaConfig> => {
	const serviceSchema = makeExecutableSchema({
		typeDefs,
		resolvers,
	});

	return {
		schema: serviceSchema,
	};
};
