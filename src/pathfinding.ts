import { HitboxCollisionTypeConst, IEntityType, PathfindingNodeIndex, PathfindingSettingsConst, SettingsConst, VisibleChunkBounds, angle, calculateDistanceSquared, distBetweenPointAndRectangle, distance, pointIsInRectangle } from "webgl-test-shared"
import Entity from "./Entity";
import CircularHitbox from "./hitboxes/CircularHitbox";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import Board from "./Board";
import PathfindingHeap from "./PathfindingHeap";
import OPTIONS from "./options";

let inaccessiblePathfindingNodes: Record<PathfindingNodeIndex, Array<number>> = {};

const footprintNodeOffsets = new Array<Array<number>>();

const getNode = (nodeX: number, nodeY: number): number => {
   return (nodeY + 1) * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX + 1;
}

// 
// Mark borders as inaccessible
// 

// Bottom border
for (let nodeX = 0; nodeX < PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 2; nodeX++) {
   const node = getNode(nodeX, -1);
   markPathfindingNodeOccupance(node, 0);
}
// Top border
for (let nodeX = 0; nodeX < PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 2; nodeX++) {
   const node = getNode(nodeX, PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 2);
   markPathfindingNodeOccupance(node, 0);
}
// Left border
for (let nodeY = -1; nodeY < PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1; nodeY++) {
   const node = getNode(-1, nodeY);
   markPathfindingNodeOccupance(node, 0);
}
// Right border
for (let nodeY = -1; nodeY < PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1; nodeY++) {
   const node = getNode(PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 2, nodeY);
   markPathfindingNodeOccupance(node, 0);
}

// Calculate footprint node offsets
const MAX_FOOTPRINT = 3;
for (let footprint = 1; footprint <= MAX_FOOTPRINT; footprint++) {
   const footprintSquared = footprint * footprint;
   
   const offsets = new Array<number>();
   for (let offsetX = -footprint; offsetX <= footprint; offsetX++) {
      for (let offsetY = -footprint; offsetY <= footprint; offsetY++) {
         if (offsetX * offsetX + offsetY * offsetY > footprintSquared) {
            continue;
         }

         const offset = offsetY * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + offsetX;
         offsets.push(offset);
      }
   }

   footprintNodeOffsets.push(offsets);
}

const nodeIsAccessibleForEntity = (node: PathfindingNodeIndex, ignoredEntityIDs: ReadonlyArray<number>, pathfindingEntityFootprint: number): boolean => {
   // @Incomplete: Prevent wrap-around on the edges
   const nodeOffsets = footprintNodeOffsets[pathfindingEntityFootprint - 1];
   for (let i = 0; i < nodeOffsets.length; i++) {
      const currentNode = node + nodeOffsets[i];

      if (inaccessiblePathfindingNodes[currentNode] === undefined) {
         continue;
      }
      
      // If the node is occupied by anything other than the pathfinding or target entity, then the node isn't accessible
      for (let i = 0; i < inaccessiblePathfindingNodes[currentNode].length; i++) {
         const id = inaccessiblePathfindingNodes[currentNode][i];
         if (ignoredEntityIDs.indexOf(id) === -1) {
            return false;
         }
      }
   }

   return true;
}

const nodeIsFree = (node: PathfindingNodeIndex): boolean => {
   return !inaccessiblePathfindingNodes.hasOwnProperty(node);
}

const getCircularHitboxOccupiedNodes = (hitbox: CircularHitbox): ReadonlyArray<PathfindingNodeIndex> => {
   const minX = hitbox.calculateHitboxBoundsMinX();
   const maxX = hitbox.calculateHitboxBoundsMaxX();
   const minY = hitbox.calculateHitboxBoundsMinY();
   const maxY = hitbox.calculateHitboxBoundsMaxY();

   const centerX = hitbox.x / PathfindingSettingsConst.NODE_SEPARATION;
   const centerY = hitbox.y / PathfindingSettingsConst.NODE_SEPARATION;
   
   const minNodeX = Math.floor(minX / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeX = Math.ceil(maxX / PathfindingSettingsConst.NODE_SEPARATION);
   const minNodeY = Math.floor(minY / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeY = Math.ceil(maxY / PathfindingSettingsConst.NODE_SEPARATION);

   // Make soft hitboxes take up less node radius so that it easier to pathfind around them
   const radiusOffset = hitbox.collisionType === HitboxCollisionTypeConst.hard ? 0.5 : 0;
   const hitboxNodeRadius = hitbox.radius / PathfindingSettingsConst.NODE_SEPARATION + radiusOffset;
   const hitboxNodeRadiusSquared = hitboxNodeRadius * hitboxNodeRadius;

   const occupiedNodes = new Array<PathfindingNodeIndex>();
   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const xDiff = nodeX - centerX;
         const yDiff = nodeY - centerY;
         if (xDiff * xDiff + yDiff * yDiff <= hitboxNodeRadiusSquared) {
            const nodeIndex = getNode(nodeX, nodeY);
            occupiedNodes.push(nodeIndex);
         }
      }
   }
   return occupiedNodes;
}

const getRectangularHitboxOccupiedNodes = (hitbox: RectangularHitbox): ReadonlyArray<PathfindingNodeIndex> => {
   const minX = hitbox.calculateHitboxBoundsMinX();
   const maxX = hitbox.calculateHitboxBoundsMaxX();
   const minY = hitbox.calculateHitboxBoundsMinY();
   const maxY = hitbox.calculateHitboxBoundsMaxY();

   const rectPosX = hitbox.x;
   const rectPosY = hitbox.y;
   
   // @Speed: Math.round might also work
   const minNodeX = Math.floor(minX / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeX = Math.ceil(maxX / PathfindingSettingsConst.NODE_SEPARATION);
   const minNodeY = Math.floor(minY / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeY = Math.ceil(maxY / PathfindingSettingsConst.NODE_SEPARATION);

   // Make soft hitboxes take up less node radius so that it easier to pathfind around them
   const nodeClearance = hitbox.collisionType === HitboxCollisionTypeConst.hard ? PathfindingSettingsConst.NODE_SEPARATION * 0.5 : 0;

   const occupiedNodes = new Array<PathfindingNodeIndex>();
   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const x = nodeX * PathfindingSettingsConst.NODE_SEPARATION;
         const y = nodeY * PathfindingSettingsConst.NODE_SEPARATION;
         if (distBetweenPointAndRectangle(x, y, rectPosX, rectPosY, hitbox.width, hitbox.height, hitbox.rotation) <= nodeClearance) {
            const nodeIndex = getNode(nodeX, nodeY);
            occupiedNodes.push(nodeIndex);
         }
      }
   }
   return occupiedNodes;
}

export function getHitboxOccupiedNodes(hitbox: CircularHitbox | RectangularHitbox): ReadonlyArray<PathfindingNodeIndex> {
   if (hitbox.hasOwnProperty("radius")) {
      return getCircularHitboxOccupiedNodes(hitbox as CircularHitbox);
   } else {
      return getRectangularHitboxOccupiedNodes(hitbox as RectangularHitbox);
   }
}

function markPathfindingNodeOccupance(node: PathfindingNodeIndex, entityID: number): void {
   if (!inaccessiblePathfindingNodes.hasOwnProperty(node)) {
      inaccessiblePathfindingNodes[node] = [entityID];
   } else {
      inaccessiblePathfindingNodes[node].push(entityID);
   }
}

export function markPathfindingNodeClearance(nodeIndex: PathfindingNodeIndex, entityID: number): void {
   const idx = inaccessiblePathfindingNodes[nodeIndex].indexOf(entityID);

   inaccessiblePathfindingNodes[nodeIndex].splice(idx, 1);
   if (inaccessiblePathfindingNodes[nodeIndex].length === 0) {
      delete inaccessiblePathfindingNodes[nodeIndex];
   }
}

export function markWallTileInPathfinding(tileX: number, tileY: number): void {
   const x = tileX * SettingsConst.TILE_SIZE;
   const y = tileY * SettingsConst.TILE_SIZE;

   const minNodeX = Math.ceil(x / PathfindingSettingsConst.NODE_SEPARATION);
   const minNodeY = Math.floor(y / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeX = Math.ceil((x + SettingsConst.TILE_SIZE) / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeY = Math.floor((y + SettingsConst.TILE_SIZE) / PathfindingSettingsConst.NODE_SEPARATION);

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const node = getNode(nodeX, nodeY);
         markPathfindingNodeOccupance(node, 0);
      }
   }
}

export function getClosestPathfindNode(x: number, y: number): PathfindingNodeIndex {
   const nodeX = Math.round(x / PathfindingSettingsConst.NODE_SEPARATION);
   const nodeY = Math.round(y / PathfindingSettingsConst.NODE_SEPARATION);
   return getNode(nodeX, nodeY);
}

export function positionIsAccessible(x: number, y: number, ignoredEntityIDs: ReadonlyArray<number>, pathfindingEntityFootprint: number): boolean {
   const node = getClosestPathfindNode(x, y);
   return nodeIsAccessibleForEntity(node, ignoredEntityIDs, pathfindingEntityFootprint);
}

export function getAngleToNode(entity: Entity, node: PathfindingNodeIndex): number {
   const x = (node % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1) * PathfindingSettingsConst.NODE_SEPARATION;
   const y = (Math.floor(node / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) - 1) * PathfindingSettingsConst.NODE_SEPARATION;
   return angle(x - entity.position.x, y - entity.position.y);
}

export function getDistanceToNode(entity: Entity, node: PathfindingNodeIndex): number {
   const x = (node % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1) * PathfindingSettingsConst.NODE_SEPARATION;
   const y = (Math.floor(node / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) - 1) * PathfindingSettingsConst.NODE_SEPARATION;

   let diffX = entity.position.x - x;
   let diffY = entity.position.y - y;
   return Math.sqrt(diffX * diffX + diffY * diffY);
}

export function getDistFromNode(entity: Entity, node: PathfindingNodeIndex): number {
   const x = (node % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1) * PathfindingSettingsConst.NODE_SEPARATION;
   const y = (Math.floor(node / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) - 1) * PathfindingSettingsConst.NODE_SEPARATION;

   return Math.sqrt(Math.pow(x - entity.position.x, 2) + Math.pow(y - entity.position.y, 2));
}

export function getDistBetweenNodes(node1: PathfindingNodeIndex, node2: PathfindingNodeIndex): number {
   const x1 = node1 % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1;
   const y1 = Math.floor(node1 / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) - 1;

   const x2 = node2 % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1;
   const y2 = Math.floor(node2 / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) - 1;

   const diffX = x1 - x2;
   const diffY = y1 - y2;
   return Math.sqrt(diffX * diffX + diffY * diffY);
}

export function entityHasReachedNode(entity: Entity, node: PathfindingNodeIndex): boolean {
   const x = (node % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1) * PathfindingSettingsConst.NODE_SEPARATION;
   const y = (Math.floor(node / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) - 1) * PathfindingSettingsConst.NODE_SEPARATION;
   const distSquared = calculateDistanceSquared(entity.position.x, entity.position.y, x, y);
   return distSquared <= PathfindingSettingsConst.NODE_REACH_DIST * PathfindingSettingsConst.NODE_SEPARATION;
}

const aStarHeuristic = (startNode: PathfindingNodeIndex, endNode: PathfindingNodeIndex): number => {
   const startNodeX = startNode % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1;
   const startNodeY = Math.floor(startNode / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) - 1;
   const endNodeX = endNode % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1;
   const endNodeY = Math.floor(endNode / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) - 1;

   let diffX = startNodeX - endNodeX;
   let diffY = startNodeY - endNodeY;
   return Math.sqrt(diffX * diffX + diffY * diffY);
}

export const enum PathfindFailureDefault {
   /** Returns an empty path */
   returnEmpty,
   /** Returns the path to the node which was closest to the goal */
   returnClosest
}

export interface PathfindOptions {
   readonly goalRadius: number;
   readonly failureDefault: PathfindFailureDefault;
}

export function getEntityFootprint(radius: number): number {
   // @Incomplete
   // @Hack: Add 1 to account for the fact that a node's occupance can mean that the hitbox overlaps anywhere in the 3x3 grid of nodes around that node
   
   return Math.floor(radius / PathfindingSettingsConst.NODE_SEPARATION) + 1;
}

export function pathIsClear(startX: number, startY: number, endX: number, endY: number, ignoredEntityIDs: ReadonlyArray<number>, pathfindingEntityFootprint: number): boolean {
   const start = getClosestPathfindNode(startX, startY);
   const goal = getClosestPathfindNode(endX, endY);

   return pathBetweenNodesIsClear(start, goal, ignoredEntityIDs, pathfindingEntityFootprint);
}

/**
 * A-star pathfinding algorithm
 * @param startX 
 * @param startY 
 * @param endX 
 * @param endY 
 * @param ignoredEntityIDs 
 * @param pathfindingEntityFootprint Radius of the entity's footprint in nodes
 * @param options 
 * @returns 
 */
export function pathfind(startX: number, startY: number, endX: number, endY: number, ignoredEntityIDs: ReadonlyArray<number>, pathfindingEntityFootprint: number, options: PathfindOptions): Array<PathfindingNodeIndex> {
   const start = getClosestPathfindNode(startX, startY);
   const goal = getClosestPathfindNode(endX, endY);

   if (options.goalRadius === 0 && !nodeIsAccessibleForEntity(goal, ignoredEntityIDs, pathfindingEntityFootprint)) {
      console.trace();
      console.warn("Goal is inaccessible!");
      return [];
   }

   if (pathBetweenNodesIsClear(start, goal, ignoredEntityIDs, pathfindingEntityFootprint)) {
      return [start, goal];
   }
   
   const cameFrom: Record<PathfindingNodeIndex, number> = {};

   const gScore: Record<PathfindingNodeIndex, number> = {};
   gScore[start] = 0;

   const fScore: Record<PathfindingNodeIndex, number> = {};
   fScore[start] = aStarHeuristic(start, goal);

   const openSet = new PathfindingHeap(); // @Speed
   openSet.gScore = gScore;
   openSet.fScore = fScore;
   openSet.addNode(start);

   const closedSet = new Set<PathfindingNodeIndex>();
   
   let i = 0;
   while (openSet.currentItemCount > 0) {
      // @Cleanup @Incomplete: Is this supposed to happen?
      if (++i >= 5000) {
         console.warn("!!! POTENTIAL UNRESOLVEABLE PATH !!!");
         console.trace();
         break;
      }

      let current = openSet.removeFirst();
      closedSet.add(current);

      // If reached the goal, return the path from start to the goal
      if ((options.goalRadius === 0 && current === goal) || (options.goalRadius > 0 && getDistBetweenNodes(current, goal) <= options.goalRadius)) {
         // Reconstruct the path
         const path: Array<PathfindingNodeIndex> = [current];
         while (cameFrom.hasOwnProperty(current)) {
            current = cameFrom[current];
            path.splice(0, 0, current);
         }
         return path;
      }

      const currentGScore = gScore[current];

      
      const nodeX = current % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1;
      const nodeY = Math.floor(current / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) - 1;

      const neighbours = new Array<PathfindingNodeIndex>();

      // @Incomplete: Wrapping

      // Left neighbour
      const leftNode = getNode(nodeX - 1, nodeY);
      if (!closedSet.has(leftNode)) {
         if (nodeIsAccessibleForEntity(leftNode, ignoredEntityIDs, pathfindingEntityFootprint)) {
            neighbours.push(leftNode);
         } else {
            closedSet.add(leftNode);
         }
      }
      
      // Right neighbour
      const rightNode = getNode(nodeX + 1, nodeY);
      if (!closedSet.has(rightNode)) {
         if (nodeIsAccessibleForEntity(rightNode, ignoredEntityIDs, pathfindingEntityFootprint)) {
            neighbours.push(rightNode);
         } else {
            closedSet.add(rightNode);
         }
      }

      // Bottom neighbour
      const bottomNode = getNode(nodeX, nodeY - 1);
      if (!closedSet.has(bottomNode)) {
         if (nodeIsAccessibleForEntity(bottomNode, ignoredEntityIDs, pathfindingEntityFootprint)) {
            neighbours.push(bottomNode);
         } else {
            closedSet.add(bottomNode);
         }
      }

      // Top neighbour
      const topNode = getNode(nodeX, nodeY + 1);
      if (!closedSet.has(topNode)) {
         if (nodeIsAccessibleForEntity(topNode, ignoredEntityIDs, pathfindingEntityFootprint)) {
            neighbours.push(topNode);
         } else {
            closedSet.add(topNode);
         }
      }

      // Top left neighbour
      const topLeftNode = getNode(nodeX - 1, nodeY + 1);
      if (!closedSet.has(topLeftNode)) {
         if (nodeIsAccessibleForEntity(topLeftNode, ignoredEntityIDs, pathfindingEntityFootprint)) {
            neighbours.push(topLeftNode);
         } else {
            closedSet.add(topLeftNode);
         }
      }

      // Top right neighbour
      const topRightNode = getNode(nodeX + 1, nodeY + 1);
      if (!closedSet.has(topRightNode)) {
         if (nodeIsAccessibleForEntity(topRightNode, ignoredEntityIDs, pathfindingEntityFootprint)) {
            neighbours.push(topRightNode);
         } else {
            closedSet.add(topRightNode);
         }
      }

      // Bottom left neighbour
      const bottomLeftNode = getNode(nodeX - 1, nodeY - 1);
      if (!closedSet.has(bottomLeftNode)) {
         if (nodeIsAccessibleForEntity(bottomLeftNode, ignoredEntityIDs, pathfindingEntityFootprint)) {
            neighbours.push(bottomLeftNode);
         } else {
            closedSet.add(bottomLeftNode);
         }
      }

      // Bottom right neighbour
      const bottomRightNode = getNode(nodeX + 1, nodeY - 1);
      if (!closedSet.has(bottomRightNode)) {
         if (nodeIsAccessibleForEntity(bottomRightNode, ignoredEntityIDs, pathfindingEntityFootprint)) {
            neighbours.push(bottomRightNode);
         } else {
            closedSet.add(bottomRightNode);
         }
      }

      for (let i = 0; i < neighbours.length; i++) {
         const neighbour = neighbours[i];

         const tentativeGScore = currentGScore + aStarHeuristic(current, neighbour);
         const neighbourGScore = gScore.hasOwnProperty(neighbour) ? gScore[neighbour] : 999999;
         if (tentativeGScore < neighbourGScore) {
            cameFrom[neighbour] = current;
            gScore[neighbour] = tentativeGScore;
            fScore[neighbour] = tentativeGScore + aStarHeuristic(neighbour, goal);

            if (!openSet.containsNode(neighbour)) {
               openSet.addNode(neighbour);
            }
         }
      }
   }

   switch (options.failureDefault) {
      case PathfindFailureDefault.returnClosest: {
         const evaluatedNodes = Object.keys(gScore);

         if (evaluatedNodes.length === 0) {
            throw new Error();
         }
         
         // Find the node which is the closest to the goal
         let minHScore = 9999999999;
         let closestNodeToGoal!: PathfindingNodeIndex;
         for (let i = 0; i < evaluatedNodes.length; i++) {
            const node = Number(evaluatedNodes[i]);

            const hScore = aStarHeuristic(node, goal);
            if (hScore < minHScore) {
               minHScore = hScore;
               closestNodeToGoal = node;
            }
         }
         
         // Construct the path back from that node
         // @Cleanup: Copy and paste
         let current = closestNodeToGoal;
         const path: Array<PathfindingNodeIndex> = [current];
         while (cameFrom.hasOwnProperty(current)) {
            current = cameFrom[current];
            path.splice(0, 0, current);
         }
         return path;
      }
      case PathfindFailureDefault.returnEmpty: {
         if (!OPTIONS.inBenchmarkMode) {
            console.warn("FAILURE");
            console.trace();
         }
         return [];
      }
   }
}

const pathBetweenNodesIsClear = (node1: PathfindingNodeIndex, node2: PathfindingNodeIndex, ignoredEntityIDs: ReadonlyArray<number>, pathfindingEntityFootprint: number): boolean => {
   // Convert to node coordinates
   const x0 = node1 % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1;
   const y0 = Math.floor(node1 / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) - 1;
   const x1 = node2 % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH - 1;
   const y1 = Math.floor(node2 / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) - 1;
   
   const dx = Math.abs(x0 - x1);
   const dy = Math.abs(y0 - y1);

   // Starting tile coordinates
   let x = Math.floor(x0);
   let y = Math.floor(y0);

   const dt_dx = 1 / dx; 
   const dt_dy = 1 / dy;

   let n = 1;
   let x_inc, y_inc;
   let t_next_vertical, t_next_horizontal;

   if (dx === 0) {
      x_inc = 0;
      t_next_horizontal = dt_dx; // Infinity
   } else if (x1 > x0) {
      x_inc = 1;
      n += Math.floor(x1) - x;
      t_next_horizontal = (Math.floor(x0) + 1 - x0) * dt_dx;
   } else {
      x_inc = -1;
      n += x - Math.floor(x1);
      t_next_horizontal = (x0 - Math.floor(x0)) * dt_dx;
   }

   if (dy === 0) {
      y_inc = 0;
      t_next_vertical = dt_dy; // Infinity
   } else if (y1 > y0) {
      y_inc = 1;
      n += Math.floor(y1) - y;
      t_next_vertical = (Math.floor(y0) + 1 - y0) * dt_dy;
   } else {
      y_inc = -1;
      n += y - Math.floor(y1);
      t_next_vertical = (y0 - Math.floor(y0)) * dt_dy;
   }

   for (; n > 0; n--) {
      const node = getNode(x, y);
      if (!nodeIsAccessibleForEntity(node, ignoredEntityIDs, pathfindingEntityFootprint)) {
         return false;
      }

      if (t_next_vertical < t_next_horizontal) {
         y += y_inc;
         t_next_vertical += dt_dy;
      } else {
         x += x_inc;
         t_next_horizontal += dt_dx;
      }
   }

   return true;
}

export function smoothPath(path: ReadonlyArray<PathfindingNodeIndex>, ignoredEntityIDs: ReadonlyArray<number>, pathfindingEntityFootprint: number): Array<PathfindingNodeIndex> {
   const smoothedPath = new Array<PathfindingNodeIndex>();
   let lastCheckpoint = path[0];
   let previousNode = path[1];
   for (let i = 2; i < path.length; i++) {
      const node = path[i];

      if (!pathBetweenNodesIsClear(node, lastCheckpoint, ignoredEntityIDs, pathfindingEntityFootprint)) {
         smoothedPath.push(previousNode);
         lastCheckpoint = previousNode;
      }

      previousNode = node;
   }
   
   // If the path was always clear (lastCheckpoint is never updated), add the first node
   if (lastCheckpoint === path[0]) {
      smoothedPath.push(lastCheckpoint);
   }
   smoothedPath.push(path[path.length - 1]);
   
   return smoothedPath;
}

export function getVisiblePathfindingNodeOccupances(visibleChunkBounds: VisibleChunkBounds): ReadonlyArray<PathfindingNodeIndex> {
   // @Hack @Incomplete: Adding 1 to the max vals may cause extra nodes to be sent
   const minNodeX = Math.ceil(visibleChunkBounds[0] * SettingsConst.CHUNK_UNITS / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeX = Math.floor((visibleChunkBounds[1] + 1) * SettingsConst.CHUNK_UNITS / PathfindingSettingsConst.NODE_SEPARATION);
   const minNodeY = Math.ceil(visibleChunkBounds[2] * SettingsConst.CHUNK_UNITS / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeY = Math.floor((visibleChunkBounds[3] + 1) * SettingsConst.CHUNK_UNITS / PathfindingSettingsConst.NODE_SEPARATION);

   const occupances = new Array<PathfindingNodeIndex>();
   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const node = getNode(nodeX, nodeY);
         if (!nodeIsFree(node)) {
            occupances.push(node);
         }
      }
   }
   return occupances;
}

export function entityCanBlockPathfinding(entityType: IEntityType): boolean {
   return entityType !== IEntityType.itemEntity
      && entityType !== IEntityType.slimeSpit
      && entityType !== IEntityType.woodenArrowProjectile
      && entityType !== IEntityType.slimewisp
      && entityType !== IEntityType.blueprintEntity;
}

export function updateEntityPathfindingNodeOccupance(entity: Entity): void {
   for (const node of entity.occupiedPathfindingNodes) {
      markPathfindingNodeClearance(node, entity.id);
   }
   entity.occupiedPathfindingNodes = new Set();

   for (let i = 0; i < entity.hitboxes.length; i++) {
      const hitbox = entity.hitboxes[i];

      // Add to occupied pathfinding nodes
      const occupiedNodes = getHitboxOccupiedNodes(hitbox);
      for (let i = 0; i < occupiedNodes.length; i++) {
         const node = occupiedNodes[i];
         if (!entity.occupiedPathfindingNodes.has(node)) {
            markPathfindingNodeOccupance(node, entity.id);
            entity.occupiedPathfindingNodes.add(node);
         }
      }
   }
}

export function updateDynamicPathfindingNodes(): void {
   if (Board.ticks % 3 !== 0) {
      return;
   }

   for (let i = 0; i < Board.entities.length; i++) {
      const entity = Board.entities[i];
      // @Speed: bad. probably faster to just add to array when dirtied
      if (entity.pathfindingNodesAreDirty && entityCanBlockPathfinding(entity.type)) {
         updateEntityPathfindingNodeOccupance(entity);
         entity.pathfindingNodesAreDirty = false;
      }
   }
}

export function clearEntityPathfindingNodes(entity: Entity): void {
   // Remove occupied pathfinding nodes
   for (const node of entity.occupiedPathfindingNodes) {
      markPathfindingNodeClearance(node, entity.id);
   }
}