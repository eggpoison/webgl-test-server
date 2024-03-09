import { IEntityType, PathfindingNodeIndex, PathfindingSettingsConst, SettingsConst, VisibleChunkBounds, angle, calculateDistanceSquared, distance, pointIsInRectangle } from "webgl-test-shared"
import Entity, { ID_SENTINEL_VALUE } from "./Entity";
import CircularHitbox from "./hitboxes/CircularHitbox";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import Board from "./Board";

let inaccessiblePathfindingNodes: Record<PathfindingNodeIndex, Array<number>> = {};


// 
// Mark borders as inaccessible
// 

// Bottom border
for (let nodeX = 0; nodeX < PathfindingSettingsConst.NODES_IN_WORLD_WIDTH; nodeX++) {
   const node = -1 * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX;
   inaccessiblePathfindingNodes[node] = [ID_SENTINEL_VALUE];
}
// Top border
for (let nodeX = 0; nodeX < PathfindingSettingsConst.NODES_IN_WORLD_WIDTH; nodeX++) {
   const node = PathfindingSettingsConst.NODES_IN_WORLD_WIDTH * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX;
   inaccessiblePathfindingNodes[node] = [ID_SENTINEL_VALUE];
}
// Left border
for (let nodeY = -1; nodeY <= PathfindingSettingsConst.NODES_IN_WORLD_WIDTH; nodeY++) {
   const node = nodeY * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + -1;
   inaccessiblePathfindingNodes[node] = [ID_SENTINEL_VALUE];
}
// Right border
for (let nodeY = PathfindingSettingsConst.NODES_IN_WORLD_WIDTH; nodeY <= PathfindingSettingsConst.NODES_IN_WORLD_WIDTH; nodeY++) {
   const node = nodeY * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + -1;
   inaccessiblePathfindingNodes[node] = [ID_SENTINEL_VALUE];
}

interface HeapItem {
   readonly node: PathfindingNodeIndex;
   heapIndex: number;
}

class Heap {
   private readonly items = new Array<HeapItem>();
   public currentItemCount = 0;

   public gScore: Record<PathfindingNodeIndex, number> = {};
   public fScore: Record<PathfindingNodeIndex, number> = {};
   
   public addNode(node: PathfindingNodeIndex): void {
      const item: HeapItem = {
         node: node,
         heapIndex: this.currentItemCount
      };
      if (this.currentItemCount >= this.items.length) {
         this.items.push(item);
      } else {
         this.items[this.currentItemCount] = item;
      }
      this.sortUp(item);
      this.currentItemCount++;
   }

   public removeFirst(): PathfindingNodeIndex {
      const firstItem = this.items[0];
      this.currentItemCount--;
      this.items[0] = this.items[this.currentItemCount];
      this.items[0].heapIndex = 0;
      this.sortDown(this.items[0]);
      return firstItem.node;
   }

   public updateItem(item: HeapItem): void {
      this.sortUp(item);
   }

   public containsNode(node: PathfindingNodeIndex): boolean {
      // @Speed
      for (let i = 0; i < this.currentItemCount; i++) {
         const item = this.items[i];
         if (item.node === node) {
            return true;
         }
      }
      return false;
      // return this.items[item.heapIndex].node === item.node;
   }

   private sortDown(item: HeapItem): void {
      while (true) {
         const childIndexLeft = item.heapIndex * 2 + 1;
         const childIndexRight = item.heapIndex * 2 + 2;
         
         let swapIndex = 0;
         if (childIndexLeft < this.currentItemCount) {
            swapIndex = childIndexLeft;

            if (childIndexRight < this.currentItemCount) {
               if (this.compareTo(this.items[childIndexLeft], this.items[childIndexRight]) < 0) {
                  swapIndex = childIndexRight;
               }
            }

            if (this.compareTo(item, this.items[swapIndex]) < 0) {
               this.swap(item, this.items[swapIndex]);
            } else {
               return;
            }
         } else {
            return;
         }
      }
   }

   private sortUp(item: HeapItem): void {
      let parentIndex = Math.floor((item.heapIndex - 1) / 2); // @Speed
      while (parentIndex >= 0) { // @Speed: Prevent parent index from going negative!
         const parentItem = this.items[parentIndex];
         if (this.compareTo(item, parentItem) > 0) {
            this.swap(item, parentItem);
         } else {
            break; 
         }

         parentIndex = Math.floor((item.heapIndex - 1) / 2);
      }
   }

   private swap(item1: HeapItem, item2: HeapItem): void {
      this.items[item1.heapIndex] = item2;
      this.items[item2.heapIndex] = item1;

      const item1HeapIndex = item1.heapIndex;
      item1.heapIndex = item2.heapIndex;
      item2.heapIndex = item1HeapIndex;
   }

   private compareTo(item1: HeapItem, item2: HeapItem): number {
      let compare = this.fScore[item1.node] - this.fScore[item2.node];
      if (compare === 0) {
         const item1HCost = this.fScore[item1.node] - this.gScore[item1.node];
         const item2HCost = this.fScore[item2.node] - this.gScore[item2.node];
         compare = item1HCost - item2HCost;
      }
      return -compare;
   }
}

const nodeIsAccessibleForEntity = (node: PathfindingNodeIndex, pathfindingEntityID: number, targetEntityID: number, pathfindingEntityFootprint: number): boolean => {
   // First make sure that the node itself is accessible
   if (inaccessiblePathfindingNodes.hasOwnProperty(node)) {
      for (let i = 0; i < inaccessiblePathfindingNodes[node].length; i++) {
         const id = inaccessiblePathfindingNodes[node][i];
         if (id !== pathfindingEntityID && id !== targetEntityID) {
            return false;
         }
      }
   }
   
   const centerNodeX = node % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH;
   const centerNodeY = Math.floor(node / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH);

   // @Hack: Add 1 to account for the fact that a node's occupance can mean that the hitbox overlaps anywhere in the 3x3 grid of nodes around that node
   const nodeFootprint = pathfindingEntityFootprint / PathfindingSettingsConst.NODE_SEPARATION + 1;
   const nodeFootprintSquared = nodeFootprint * nodeFootprint;

   const minNodeX = Math.ceil(centerNodeX - nodeFootprint);
   const maxNodeX = Math.floor(centerNodeX + nodeFootprint);
   const minNodeY = Math.ceil(centerNodeY - nodeFootprint);
   const maxNodeY = Math.floor(centerNodeY + nodeFootprint);

   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         let distX = nodeX - centerNodeX;
         let distY = nodeY - centerNodeY;
         if (distX * distX + distY * distY > nodeFootprintSquared) {
            continue;
         }

         const currentNode = nodeY * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX;
         if (!inaccessiblePathfindingNodes.hasOwnProperty(currentNode)) {
            continue;
         }
         
         // If the node is occupied by anything other than the pathfinding or target entity, then the node isn't accessible
         for (let i = 0; i < inaccessiblePathfindingNodes[currentNode].length; i++) {
            const id = inaccessiblePathfindingNodes[currentNode][i];
            if (id !== pathfindingEntityID && id !== targetEntityID) {
               return false;
            }
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

   const centerX = (hitbox.object.position.x + hitbox.rotatedOffsetX) / PathfindingSettingsConst.NODE_SEPARATION;
   const centerY = (hitbox.object.position.y + hitbox.rotatedOffsetY) / PathfindingSettingsConst.NODE_SEPARATION;
   
   const minNodeX = Math.ceil(minX / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeX = Math.floor(maxX / PathfindingSettingsConst.NODE_SEPARATION);
   const minNodeY = Math.ceil(minY / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeY = Math.floor(maxY / PathfindingSettingsConst.NODE_SEPARATION);

   const hitboxNodeRadius = hitbox.radius / PathfindingSettingsConst.NODE_SEPARATION;
   const hitboxNodeRadiusSquared = hitboxNodeRadius * hitboxNodeRadius;

   const occupiedNodes = new Array<PathfindingNodeIndex>();
   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const xDiff = nodeX - centerX;
         const yDiff = nodeY - centerY;
         if (xDiff * xDiff + yDiff * yDiff <= hitboxNodeRadiusSquared) {
            const nodeIndex = nodeY * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX;
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

   const rectPosX = (hitbox.object.position.x + hitbox.rotatedOffsetX);
   const rectPosY = (hitbox.object.position.y + hitbox.rotatedOffsetY);
   
   const minNodeX = Math.ceil(minX / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeX = Math.floor(maxX / PathfindingSettingsConst.NODE_SEPARATION);
   const minNodeY = Math.ceil(minY / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeY = Math.floor(maxY / PathfindingSettingsConst.NODE_SEPARATION);

   const occupiedNodes = new Array<PathfindingNodeIndex>();
   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const x = nodeX * PathfindingSettingsConst.NODE_SEPARATION;
         const y = nodeY * PathfindingSettingsConst.NODE_SEPARATION;
         if (pointIsInRectangle(x, y, rectPosX, rectPosY, hitbox.width, hitbox.height, hitbox.rotation + hitbox.object.rotation)) {
            const nodeIndex = nodeY * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX;
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

export function markPathfindingNodeOccupance(nodeIndex: PathfindingNodeIndex, entityID: number): void {
   if (!inaccessiblePathfindingNodes.hasOwnProperty(nodeIndex)) {
      inaccessiblePathfindingNodes[nodeIndex] = [entityID];
   } else {
      inaccessiblePathfindingNodes[nodeIndex].push(entityID);
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
         const nodeIndex = nodeY * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX;
         markPathfindingNodeOccupance(nodeIndex, ID_SENTINEL_VALUE);
      }
   }
}

export function getClosestPathfindNode(x: number, y: number): PathfindingNodeIndex {
   const nodeX = Math.round(x / PathfindingSettingsConst.NODE_SEPARATION);
   const nodeY = Math.round(y / PathfindingSettingsConst.NODE_SEPARATION);
   return nodeY * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX;
}

export function positionIsAccessible(x: number, y: number, pathfindingEntityID: number, pathfindingEntityFootprint: number): boolean {
   const node = getClosestPathfindNode(x, y);
   return nodeIsAccessibleForEntity(node, pathfindingEntityID, pathfindingEntityID, pathfindingEntityFootprint);
}

export function getAngleToNode(entity: Entity, node: PathfindingNodeIndex): number {
   const x = node % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH * PathfindingSettingsConst.NODE_SEPARATION;
   const y = Math.floor(node / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) * PathfindingSettingsConst.NODE_SEPARATION;
   return angle(x - entity.position.x, y - entity.position.y);
}

export function getDistFromNode(entity: Entity, node: PathfindingNodeIndex): number {
   const x = node % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH * PathfindingSettingsConst.NODE_SEPARATION;
   const y = Math.floor(node / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) * PathfindingSettingsConst.NODE_SEPARATION;

   return Math.sqrt(Math.pow(x - entity.position.x, 2) + Math.pow(y - entity.position.y, 2));
}

export function entityHasReachedNode(entity: Entity, node: PathfindingNodeIndex): boolean {
   const x = node % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH * PathfindingSettingsConst.NODE_SEPARATION;
   const y = Math.floor(node / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH) * PathfindingSettingsConst.NODE_SEPARATION;
   const distSquared = calculateDistanceSquared(entity.position.x, entity.position.y, x, y);
   return distSquared <= PathfindingSettingsConst.NODE_REACH_DIST * PathfindingSettingsConst.NODE_SEPARATION;
}

const aStarHeuristic = (startNode: PathfindingNodeIndex, endNode: PathfindingNodeIndex): number => {
   const startNodeX = startNode % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH;
   const startNodeY = Math.floor(startNode / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH);
   const endNodeX = endNode % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH;
   const endNodeY = Math.floor(endNode / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH);
   return distance(startNodeX, startNodeY, endNodeX, endNodeY);
}

const getNodeNeighbours = (node: PathfindingNodeIndex, pathfindingEntityID: number, targetEntityID: number, pathfindingEntityFootprint: number): ReadonlyArray<PathfindingNodeIndex> => {
   const nodeX = node % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH;
   const nodeY = Math.floor(node / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH);

   const neighbours = new Array<PathfindingNodeIndex>();

   // @Speed: Only need to check the top rect for top neighbour, left for left neighbour, etc. And don't need to check the node itself

   // Left neighbour
   const leftNode = nodeY * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX - 1;
   if (nodeIsAccessibleForEntity(leftNode, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint)) {
      neighbours.push(leftNode);
   }
   
   // Right neighbour
   const rightNode = nodeY * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX + 1;
   if (nodeIsAccessibleForEntity(rightNode, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint)) {
      neighbours.push(rightNode);
   }

   // Bottom neighbour
   const bottomNode = (nodeY - 1) * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX;
   if (nodeIsAccessibleForEntity(bottomNode, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint)) {
      neighbours.push(bottomNode);
   }

   // Top neighbour
   const topNode = (nodeY + 1) * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX;
   if (nodeIsAccessibleForEntity(topNode, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint)) {
      neighbours.push(topNode);
   }

   // Top left neighbour
   const topLeftNode = (nodeY + 1) * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX - 1;
   if (nodeIsAccessibleForEntity(topLeftNode, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint)) {
      neighbours.push(topLeftNode);
   }

   // Top right neighbour
   const topRightNode = (nodeY + 1) * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX + 1;
   if (nodeIsAccessibleForEntity(topRightNode, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint)) {
      neighbours.push(topRightNode);
   }

   // Bottom left neighbour
   const bottomLeftNode = (nodeY - 1) * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX - 1;
   if (nodeIsAccessibleForEntity(bottomLeftNode, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint)) {
      neighbours.push(bottomLeftNode);
   }

   // Bottom right neighbour
   const bottomRightNode = (nodeY - 1) * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX + 1;
   if (nodeIsAccessibleForEntity(bottomRightNode, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint)) {
      neighbours.push(bottomRightNode);
   }

   return neighbours;
}

/** A-star pathfinding algorithm */
export function pathfind(startX: number, startY: number, endX: number, endY: number, pathfindingEntityID: number, targetEntityID: number, pathfindingEntityFootprint: number): Array<PathfindingNodeIndex> {
   const start = getClosestPathfindNode(startX, startY);
   const goal = getClosestPathfindNode(endX, endY);

   if (!nodeIsAccessibleForEntity(goal, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint)) {
      // for (const id of inaccessiblePathfindingNodes[goal]) {
      //    if (id !== targetEntityID && !Board.entityRecord.hasOwnProperty(id)) {
      //       console.warn("Entity which doesn't exist is blocking off a node.")
      //    }
      // }

      // console.warn("Goal is inaccessible! at " + startX + " " + startY);
      // console.trace();
      return [];
   }

   if (pathBetweenNodesIsClear(start, goal, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint)) {
      return [start, goal];
   }
   
   const cameFrom: Record<PathfindingNodeIndex, number> = {};

   const gScore: Record<PathfindingNodeIndex, number> = {};
   gScore[start] = 0;

   const fScore: Record<PathfindingNodeIndex, number> = {};
   fScore[start] = aStarHeuristic(start, goal);

   const openSet = new Heap(); // @Speed
   openSet.gScore = gScore;
   openSet.fScore = fScore;
   openSet.addNode(start);

   // @Incomplete: Investigate the closed set
   
   let i = 0;
   while (openSet.currentItemCount > 0) {
      // @Cleanup @Incomplete: Is this supposed to happen?
      if (++i >= 5000) {
         // const e = Board.entityRecord[pathfindingEntityID];
         
         // console.warn("POTENTIAL UNRESOLVEABLE PATH at " + e.position.x + " " + e.position.y);
         // console.trace();
         return [];
      }

      let current = openSet.removeFirst();

      // If reached the goal, return the path from start to the goal
      if (current === goal) {
         // Reconstruct the path
         const path: Array<PathfindingNodeIndex> = [current];
         while (cameFrom.hasOwnProperty(current)) {
            current = cameFrom[current];
            path.splice(0, 0, current);
         }
         return path;
      }

      // @Incomplete: What impact will this including already seen nodes have?
      const currentGScore = gScore[current];
      const neighbours = getNodeNeighbours(current, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint);
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

   // On failure, return an empty array
   return [];
}

const pathBetweenNodesIsClear = (node1: PathfindingNodeIndex, node2: PathfindingNodeIndex, pathfindingEntityID: number, targetEntityID: number, pathfindingEntityFootprint: number): boolean => {
   // Convert to node coordinates
   const x0 = node1 % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH;
   const y0 = Math.floor(node1 / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH);
   const x1 = node2 % PathfindingSettingsConst.NODES_IN_WORLD_WIDTH;
   const y1 = Math.floor(node2 / PathfindingSettingsConst.NODES_IN_WORLD_WIDTH);
   
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
      const node = y * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + x;
      if (!nodeIsAccessibleForEntity(node, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint)) {
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

export function smoothPath(path: ReadonlyArray<PathfindingNodeIndex>, pathfindingEntityID: number, targetEntityID: number, pathfindingEntityFootprint: number): Array<PathfindingNodeIndex> {
   const smoothedPath = new Array<PathfindingNodeIndex>();
   let lastCheckpoint = path[0];
   let previousNode = path[1];
   for (let i = 2; i < path.length; i++) {
      const node = path[i];

      if (!pathBetweenNodesIsClear(node, lastCheckpoint, pathfindingEntityID, targetEntityID, pathfindingEntityFootprint)) {
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
   
   // Don't include the first node in the path
   smoothedPath.splice(0, 1);
   
   return smoothedPath;
}

export function getVisiblePathfindingNodeOccupances(visibleChunkBounds: VisibleChunkBounds): ReadonlyArray<PathfindingNodeIndex> {
   const minNodeX = Math.ceil(visibleChunkBounds[0] * SettingsConst.CHUNK_UNITS / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeX = Math.floor(visibleChunkBounds[1] * SettingsConst.CHUNK_UNITS / PathfindingSettingsConst.NODE_SEPARATION);
   const minNodeY = Math.ceil(visibleChunkBounds[2] * SettingsConst.CHUNK_UNITS / PathfindingSettingsConst.NODE_SEPARATION);
   const maxNodeY = Math.floor(visibleChunkBounds[3] * SettingsConst.CHUNK_UNITS / PathfindingSettingsConst.NODE_SEPARATION);

   const occupances = new Array<PathfindingNodeIndex>();
   for (let nodeX = minNodeX; nodeX <= maxNodeX; nodeX++) {
      for (let nodeY = minNodeY; nodeY <= maxNodeY; nodeY++) {
         const node = nodeY * PathfindingSettingsConst.NODES_IN_WORLD_WIDTH + nodeX;
         if (!nodeIsFree(node)) {
            occupances.push(node);
         }
      }
   }
   return occupances;
}

export function entityCanBlockPathfinding(entityType: IEntityType): boolean {
   return entityType !== IEntityType.itemEntity;
}

const updateEntityPathfindingNodeOccupance = (entity: Entity): void => {
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