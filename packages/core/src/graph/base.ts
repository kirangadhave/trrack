import { GraphEdge } from './graph_edge';
import { EdgeType, IGraph, IGraphEdge, IGraphNode } from './nodes/types';

export class Graph implements IGraph {
    static create(): IGraph {
        return new Graph();
    }

    nodes = new Map<string, IGraphNode>();
    edges = new Map<string, IGraphEdge>();

    get nnodes() {
        return this.nodes.size;
    }

    get nedges() {
        return this.edges.size;
    }

    hasNode(id: string) {
        return this.nodes.has(id);
    }

    hasEdge(id: string) {
        return this.edges.has(id);
    }

    addNode<T extends IGraphNode>(node: T): T {
        // Enter Mod

        if (this.nodes.has(node.id))
            throw new Error(`Node ${node.id} already exists!`);

        this.nodes.set(node.id, node);

        // Exit Mod
        return node;
    }

    addEdge(
        source: IGraphNode,
        target: IGraphNode,
        type: EdgeType
    ): IGraphEdge {
        // Enter Mod
        const edge = GraphEdge.create(source, target, type);

        this.edges.set(edge.id, edge);

        // Exit Mod
        return edge;
    }

    getNode<T extends IGraphNode = IGraphNode>(id: string): T {
        const node = this.nodes.get(id);

        if (!node) throw new Error(`Node ${id} not found!`);

        return node as T;
    }

    nodesBy<T extends IGraphNode = IGraphNode>(
        callback: (node: T) => boolean
    ): T[] {
        return Array.from(this.nodes.values()).filter((node) =>
            callback(<T>node)
        ) as T[];
    }
}
