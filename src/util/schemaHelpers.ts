import { delegateToSchema, SubschemaConfig } from '@graphql-tools/delegate';
import { Transform } from '@graphql-tools/utils';
import { WrapQuery } from '@graphql-tools/wrap';
import {
	GraphQLSchema,
	Kind,
	ValueNode,
	ArgumentNode,
	parseValue,
	GraphQLResolveInfo,
} from 'graphql';


interface QuerySchemaOptions<TContext = { [key: string]: any }> {
	namespace?: string;
	fieldName: string;
	args?: { [key: string]: string | ValueNode };
	context: TContext;
	info: GraphQLResolveInfo;
	transforms?: Array<Transform>;
}

export const cleanupEmptyProperties = (object: any) =>
	Object.entries(object)
		.filter(([, value]) => value !== null)
		.reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

const transformArgs = (
	args: { [key: string]: string | ValueNode } | undefined
): ArgumentNode[] => {
	return Object.entries(args || {})
		.filter(([, value]) => value !== null)
		.map(([key, v]) => {

			// first lets take care about enum lists
			const value = Array.isArray(v) ? parseValue(v.join(', ')) : v;

			// handle other types
			let valueNode;
			switch (typeof value) {
				case 'object':
					// we assume that the object is already parsed source
					valueNode = value;
					break;
				case 'number':
				case 'boolean':
					valueNode = parseValue(`${value}`);
					break;
				default:
					// for all other types, let's assume a string value
					valueNode = { kind: Kind.STRING, value: `${value}` };
			}
			// console.log(valueNode);

			return {
				kind: Kind.ARGUMENT,
				name: { kind: Kind.NAME, value: key },
				value: valueNode,
			};
		});
};

export const querySchema = (
	schema: GraphQLSchema,
	{ namespace, fieldName, args, context, info }: QuerySchemaOptions
) => {
	if (!schema ) {
		return null;
	}

	if (!namespace) {
		return delegateToSchema({
			schema,
			operation: 'query',
			fieldName,
			args,
			context,
			info
		});
	}

	return delegateToSchema({
		schema,
		operation: 'query',
		fieldName: namespace,
		context,
		info,
		transforms: [
			/**
			 * Use WrapQuery to delegate to a sub-field of userSchema, approximately equivalent to:
			 *
			 * query {
			 *  ${namespace} {
			 *    ${query}(${arguments}) {
			 *       ...subtree
			 *     }
			 *   }
			 * }
			 * via https://astexplorer.net/
			 */
			new WrapQuery(
				[namespace],
				subtree => ({
					kind: Kind.SELECTION_SET,
					selections: [
						{
							kind: Kind.FIELD,
							name: {
								kind: Kind.NAME,
								value: fieldName
							},
							arguments: transformArgs(args),
							selectionSet: subtree
						}
					]
				}),
				result => {
					if (result && result[fieldName]) {
						return result[fieldName];
					}

					return null;
				}
			)
		]
	});
};

export const queryClassicSchema = (
	schema: GraphQLSchema,
	{ namespace, fieldName, args, context, info, transforms }: QuerySchemaOptions
) => {
	if (!schema ) {
		return null;
	}

	if (!namespace) {
		return delegateToSchema({
			schema,
			operation: 'query',
			fieldName,
			args,
			context,
			info,
			transforms,
		});
	}

	return delegateToSchema({
		schema,
		operation: 'query',
		fieldName: namespace, // e.g. "mango"
		context,
		info,
		transforms: [
			/**
			 * Use WrapQuery to delegate to a sub-field of userSchema, approximately equivalent to:
			 *
			 * query {
			 *   ${namespace} {
			 *     viewer {
			 *       ${query}(${arguments}) {
			 *          ...subtree
			 *       }
			 *     }
			 *   }
			 * }
			 * via https://astexplorer.net/
			 */
			new WrapQuery(
				[namespace],
				subtree => {
					const subquery = {
						kind: Kind.SELECTION_SET,
						selections: [
							{
								kind: Kind.FIELD,
								name: {
									kind: Kind.NAME,
									value: 'viewer'
								},
								selectionSet: {
									kind: Kind.SELECTION_SET,
									selections: [
										{
											kind: Kind.FIELD,
											name: {
												kind: Kind.NAME,
												value: fieldName // e.g. "allBroadcastServices"
											},
											arguments: transformArgs(args),
											selectionSet: subtree
										}
									]
								}
							}
						]
					};
					// console.log('subquery: ', print(subquery));
					return subquery;
				},
				result => {
					if (result?.viewer && result.viewer[fieldName]) {
						return result.viewer[fieldName];
					}
					return null;
				}
			),
			...transforms || []
		]
	});
};

export const queryNodes = (
	schema: GraphQLSchema,
	{ namespace, fieldName, args, context, info }: QuerySchemaOptions
) => {
	if (!schema ) {
		return null;
	}

	if (!namespace) {
		return delegateToSchema({
			schema,
			operation: 'query',
			fieldName,
			args,
			context,
			info
		});
	}

	return delegateToSchema({
		schema,
		operation: 'query',
		fieldName: namespace,
		context,
		info,
		transforms: [
			/**
			 * Use WrapQuery to delegate to a sub-field of userSchema, approximately equivalent to:
			 *
			 * query {
			 *  ${namespace} {
			 *    ${query}(${arguments}) {
			 *      nodes {
			 *        ...subtree
			 *      }
			 *     }
			 *   }
			 * }
			 * via https://astexplorer.net/
			 */
			new WrapQuery(
				[namespace],
				subtree => ({
					kind: Kind.SELECTION_SET,
					selections: [
						{
							kind: Kind.FIELD,
							name: {
								kind: Kind.NAME,
								value: fieldName
							},
							arguments: transformArgs(args),
							selectionSet: {
								kind: Kind.SELECTION_SET,
								selections: [
									{
										kind: Kind.FIELD,
										name: { kind: Kind.NAME, value: 'nodes' },
										selectionSet: subtree
									}
								]
							}
						}
					]
				}),
				result => {
					// console.log(result);
					if (result && result[fieldName] && result[fieldName].nodes) {
						return result[fieldName].nodes;
					}

					return null;
				}
			)
		]
	});
};

// returns nodes in a wrapped entity of a relay classic schema (which has only edges, and no nodes)
export const queryClasicSchemaWrapped = (
	schema: GraphQLSchema,
	{ namespace, fieldName, args, context, info }: QuerySchemaOptions
) => {
	if (!schema || !namespace ) {
		return null;
	}

	return delegateToSchema({
		schema,
		operation: 'query',
		fieldName: namespace,
		context,
		info,
		transforms: [
			/**
			 * Use WrapQuery to delegate to a sub-field of userSchema, approximately equivalent to:
			 *
			 * query {
			 *  ${namespace} {
			 *    ${query}(${arguments}) {
			 *       items {
			 *         edges {
			 *           node {
			 *             ...subtree
			 *           }
			 *         }
			 *       }
			 *     }
			 *   }
			 * }
			 * via https://astexplorer.net/
			 */
			new WrapQuery(
				[namespace],
				subtree => ({
					kind: Kind.SELECTION_SET,
					selections: [
						{
							kind: Kind.FIELD,
							name: {
								kind: Kind.NAME,
								value: fieldName
							},
							arguments: transformArgs(args),
							selectionSet: {
								kind: Kind.SELECTION_SET,
								selections: [
									{
										kind: Kind.FIELD,
										name: { kind: Kind.NAME, value: 'items' },
										selectionSet: {
											kind: Kind.SELECTION_SET,
											selections: [
												{
													kind: Kind.FIELD,
													name: { kind: Kind.NAME, value: 'edges' },
													selectionSet: {
														kind: Kind.SELECTION_SET,
														selections: [
															{
																kind: Kind.FIELD,
																name: {
																	kind: Kind.NAME,
																	value: 'node'
																},
																selectionSet: subtree
															}
														]
													}
												}
											]
										}
									}
								]
							}
						}
					]
				}),
				result => {
					if (
						result &&
						result[fieldName] &&
						result[fieldName].items &&
						result[fieldName].items.edges &&
						Array.isArray(result[fieldName].items.edges)
					) {
						return result[fieldName].items.edges.map((edge: any) => edge.node);
					}

					return null;
				}
			)
		]
	});
};

// from https://github.com/apollographql/graphql-tools/issues/751#issuecomment-384146985

/*
export class WrapFieldsInFragment implements Transform {
	private targetSchema: GraphQLSchema;

	private parentType: string;

	private targetType: string;

	constructor(targetSchema: GraphQLSchema, parentType: string, targetType: string) {
		this.targetSchema = targetSchema;
		this.parentType = parentType;
		this.targetType = targetType;
	}

	public transformRequest(originalRequest: Request) {
		const typeInfo = new TypeInfo(this.targetSchema);
		const document = visit(
			originalRequest.document,
			visitWithTypeInfo(typeInfo, {
				// tslint:disable-next-line function-name
				[Kind.SELECTION_SET]: (node: SelectionSetNode): SelectionSetNode | null | undefined => {
					const parentType = typeInfo.getParentType();
					let selections = node.selections;

					if (parentType && parentType.name === this.parentType) {
						const fragment = parse(`fragment ${this.targetType}Fragment on ${this.targetType} ${print(node)}`);
						let inlineFragment: InlineFragmentNode | undefined;
						for (const definition of fragment.definitions) {
							if (definition.kind === Kind.FRAGMENT_DEFINITION) {
								inlineFragment = {
									kind: Kind.INLINE_FRAGMENT,
									typeCondition: definition.typeCondition,
									selectionSet: definition.selectionSet,
								};
							}
						}
						if (inlineFragment) {
							selections = selections.concat(inlineFragment);
						}
					}

					if (selections !== node.selections) {
						return {
							...node,
							selections,
						};
					}
				},
			})
		);
		return { ...originalRequest, document };
	}
}
 */
