import * as fs from 'fs';
import { printSchema } from "graphql";
import gql from "graphql-tag";

import { SubschemaConfig } from "@graphql-tools/delegate";
import { makeExecutableSchema } from "@graphql-tools/schema";

const typeDefs = gql`
scalar TDatetime

type Query {
    titles(
        distributionChannels: [TDistributionChannel!],
        types: [TType!] = [News Music],
        start: TDatetime,
        end: TDatetime,
        offset: Int = 0,
        first: Int = 100,
    ): [TTitle!]!
}

type TTitle {
    guid: ID!
    class: TType!
    title: String!
    performer: String
    composer: String
    author: String
    distributionChannels: [TDistributionChannel!]
    start: TDatetime!
    duration: Int
}

enum TDistributionChannel {
    b1
    b2
    b3
}

enum TType {
    News
    Music
    Live
    Traffic
    Weather
    Info
    Audio
    Cart
    Commercial
    Control
    Promotion
    None
}

`;

const MUSIC_ITEM = {
	__typename: "TTitle",
	class: "Music",
	id: "123",
	title: "Foo bar 42",
	performer: "Band XYZ",
	composer: null,
};

const resolvers = {
	Query: {
		titles: () => [
			MUSIC_ITEM,
		]
	},
};

export default async (): Promise<SubschemaConfig> => {
	const schema = makeExecutableSchema({
		typeDefs,
		resolvers,
	});

	return {
		schema,
		transforms: []
	};
};
