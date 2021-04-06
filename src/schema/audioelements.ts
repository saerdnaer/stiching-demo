import gql from 'graphql-tag';
import { Moment } from 'moment';


export type Element = {
	class: string;
	start: string | Date | Moment;
	title: string;
	teaserTitle?: string;
	author?: string;
	duration: number;
	raw?: null | [Element];
	[k: string]: string | number | Date | Moment | [Element] | undefined | null;
};

const typeDefs = gql`

	enum AudioElementClass {
		Music
		Cart
		News
		Traffic
		Weather
		Live
		Promotion
		Audio
		None
		Commercial
		Control
		Command
		Info
		Project
		Magazine
	}

	extend type TTitle implements AudioElement & MusicElement & NewsElement {
		isSeekableNews: Boolean
		raw: JSON @deprecated(reason: "only for internal use")
	}
	interface AudioElement {
		guid: ID!
		class: TType!
		start: TDatetime!
		duration: Int
		title: String
		raw: JSON @deprecated(reason: "only for debugging purposes")
	}
	interface NewsElement {
		author: String
		isSeekableNews: Boolean
	}
	interface MusicElement {
		performer: String
		composer: String
		#album: String
		#musicId: Int
	}
	type NewsElementType implements AudioElement & NewsElement {
		guid: ID!
		class: TType!
		start: TDatetime!
		duration: Int
		title: String
		author: String
		authors: [String!]
		raw: JSON
		isSeekableNews: Boolean
	}
	type MusicElementType implements AudioElement & MusicElement {
		guid: ID!
		class: TType!
		start: TDatetime!
		duration: Int
		title: String
		performer: String
		performers: [String!]
		composer: String
		composers: [String!]
		album: String
		musicId: Int
		raw: JSON
	}
	type AudioElementDefaultType implements AudioElement {
		guid: ID!
		class: TType!
		start: TDatetime!
		duration: Int
		title: String
		raw: JSON
	}
`;
const resolvers = {
	AudioElement: {
		__resolveType: (element: Element) => {
			switch (element?.class) {
				case 'News':
					return 'NewsElementType';
				case 'Music':
					return 'MusicElementType';
			}
			return 'AudioElementDefaultType';
		},
		// Very ugly workaround
		class: {
			selectionSet: `{ ... on TTitle {composer, performer} }`,
			resolve(element: Element) {
				return element.class;
			},
		},
	},
	NewsElementType: {
		authors: {
			selectionSet: `{ author }`,
			resolve(element: any) {
				return normalizePersons(element?.author);
			},
		},
		author: {
			selectionSet: `{ author }`,
			resolve(element: any) {
				return normalizePersons(element?.author, true)?.join('; ');
			},
		},
		isSeekableNews: {
			selectionSet: `{ author }`,
			resolve(element: any) {
				return element?.isSeekableNews || element?.author === 'Nachrichten';
			},
		},
	},
	MusicElementType: {
		performers: {
			selectionSet: `{ performer }`,
			resolve(element: any) {
				return normalizePersons(element?.performer);
			},
		},
		composers: {
			selectionSet: `{ composer }`,
			resolve(element: any) {
				return normalizePersons(element?.composer, true);
			},
		},
		composer: {
			resolve(element: any) {
				return normalizePersons(element?.composer, true)?.join('; ');
			},
		},
	},
};

export default { typeDefs, resolvers };

export const normalizePersons = (value: string, composer = false): string[] | null => {
	if (!value) {
		return null;
	}
	return [...new Set(value.trim().split(/\s?(?:,|\s+und|\/| - | \& )+\s?/g))].map((x) => x.trim()).filter((x) => x && x != '');
};