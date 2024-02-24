import { SettingsConst, Point, TileTypeConst, angle, curveWeight } from "webgl-test-shared";
import Board from "./Board";
import Tile from "./Tile";
import CircularHitbox from "./hitboxes/CircularHitbox";
import Entity, { NO_COLLISION } from "./Entity";
import RectangularHitbox from "./hitboxes/RectangularHitbox";

const TURN_CONSTANT = Math.PI / SettingsConst.TPS;
const WALL_AVOIDANCE_MULTIPLIER = 1.5;
   
const testCircularHitbox = new CircularHitbox({position: new Point(0, 0), rotation: 0}, 1, 0, 0, -1);

export function getClosestEntity(entity: Entity, entities: ReadonlyArray<Entity>): Entity {
   if (entities.length === 0) {
      throw new Error("No entities in array");
   }

   let closestEntity!: Entity;
   let minDistance = Number.MAX_SAFE_INTEGER;
   for (const currentEntity of entities) {
      const dist = entity.position.calculateDistanceBetween(currentEntity.position);
      if (dist < minDistance) {
         closestEntity = currentEntity;
         minDistance = dist;
      }
   }
   return closestEntity;
}

/** Estimates the distance it will take for the entity to stop */
const estimateStopDistance = (entity: Entity): number => {
   // @Incomplete: Hard-coded
   // Estimate time it will take for the entity to stop
   const stopTime = Math.pow(entity.velocity.length(), 0.8) / (3 * 50);
   const stopDistance = (Math.pow(stopTime, 2) + stopTime) * entity.velocity.length();
   return stopDistance;
}

export function willStopAtDesiredDistance(entity: Entity, desiredDistance: number, distance: number): boolean {
   // If the entity has a desired distance from its target, try to stop at that desired distance
   const stopDistance = estimateStopDistance(entity);
   return distance - stopDistance <= desiredDistance;
}

export function chaseAndEatItemEntity(entity: Entity, itemEntity: Entity, acceleration: number): boolean {
   if (entity.isColliding(itemEntity) !== NO_COLLISION) {
      itemEntity.remove();
      return true;
   }

   moveEntityToPosition(entity, itemEntity.position.x, itemEntity.position.y, acceleration);
   return false;
}

export function stopEntity(entity: Entity): void {
   entity.acceleration.x = 0;
   entity.acceleration.y = 0;
}

export function moveEntityToPosition(entity: Entity, positionX: number, positionY: number, acceleration: number): void {
   const direction = angle(positionX - entity.position.x, positionY - entity.position.y);
   entity.acceleration.x = acceleration * Math.sin(direction);
   entity.acceleration.y = acceleration * Math.cos(direction);
   if (direction !== entity.rotation) {
      entity.hitboxesAreDirty = true;
   }
   entity.rotation = direction;
}

export function entityHasReachedPosition(entity: Entity, positionX: number, positionY: number): boolean {
   // @Speed: garbage
   const relativeTargetPosition = entity.position.copy();
   relativeTargetPosition.x -= positionX;
   relativeTargetPosition.y -= positionY;

   const dotProduct = entity.velocity.calculateDotProduct(relativeTargetPosition);
   return dotProduct > 0;
}

// @Cleanup @Robustness: Maybe separate this into 4 different functions? (for separation, alignment, etc.)
export function runHerdAI(entity: Entity, herdMembers: ReadonlyArray<Entity>, visionRange: number, turnRate: number, minSeparationDistance: number, separationInfluence: number, alignmentInfluence: number, cohesionInfluence: number): void {
   // 
   // Find the closest herd member and calculate other data
   // 

   // Average angle of nearby entities
   let totalXVal: number = 0;
   let totalYVal: number = 0;

   let centerX = 0;
   let centerY = 0;

   let closestHerdMember: Entity | undefined;
   let minDist = Number.MAX_SAFE_INTEGER;
   let numHerdMembers = 0;
   for (let i = 0; i < herdMembers.length; i++) {
      const herdMember = herdMembers[i];

      const distance = entity.position.calculateDistanceBetween(herdMember.position);
      if (distance < minDist) {
         closestHerdMember = herdMember;
         minDist = distance;
      }

      totalXVal += Math.sin(herdMember.rotation);
      totalYVal += Math.cos(herdMember.rotation);

      centerX += herdMember.position.x;
      centerY += herdMember.position.y;
      numHerdMembers++;
   }
   if (typeof closestHerdMember === "undefined") {
      return;
   }

   centerX /= numHerdMembers;
   centerY /= numHerdMembers;

   // @Cleanup: We can probably clean up a lot of this code by using Entity's built in turn functions
   let angularVelocity = 0;
   
   const headingPrincipalValue = ((entity.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
   
   // SEPARATION
   // Steer away from herd members who are too close
   if (minDist < minSeparationDistance) {
      // Calculate the weight of the separation
      let weight = 1 - minDist / minSeparationDistance;
      weight = curveWeight(weight, 2, 0.2);
      
      // @Speed: Garbage collection
      const distanceVector = closestHerdMember.position.convertToVector(entity.position);

      const clockwiseDist = (distanceVector.direction - entity.rotation + Math.PI * 2) % (Math.PI * 2);
      const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

      if (clockwiseDist > counterclockwiseDist) {
         // Turn clockwise
         angularVelocity += turnRate * separationInfluence * weight * TURN_CONSTANT;
      } else {
         // Turn counterclockwise
         angularVelocity -= turnRate * separationInfluence * weight * TURN_CONSTANT;
      }
   }

   // ALIGNMENT
   // Orientate to nearby herd members' headings

   {
      let averageHeading = angle(totalXVal, totalYVal);
      if (averageHeading < 0) {
         averageHeading += Math.PI * 2;
      }

      // Calculate the weight of the alignment
      let angleDifference: number;
      if (averageHeading < headingPrincipalValue) {
         angleDifference = Math.min(Math.abs(averageHeading - headingPrincipalValue), Math.abs(averageHeading + Math.PI * 2 - headingPrincipalValue))
      } else {
         angleDifference = Math.min(Math.abs(headingPrincipalValue - averageHeading), Math.abs(headingPrincipalValue + Math.PI * 2 - averageHeading))
      }
      let weight = angleDifference / Math.PI;
      weight = curveWeight(weight, 2, 0.1);
      
      const clockwiseDist = (averageHeading - headingPrincipalValue + Math.PI * 2) % (Math.PI * 2);
      const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

      if (clockwiseDist < counterclockwiseDist) {
         // Turn clockwise
         angularVelocity += turnRate * alignmentInfluence * weight * TURN_CONSTANT;
      } else {
         // Turn counterclockwise
         angularVelocity -= turnRate * alignmentInfluence * weight * TURN_CONSTANT;
      }

   }

   // COHESION
   // Steer to move towards the local center of mass
   
   {
      // @Speed: Garbage collection
      
      // Calculate average position
      const centerOfMass = new Point(centerX, centerY);
      
      const toCenter = centerOfMass.convertToVector(entity.position);
      const directionToCenter = ((toCenter.direction % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

      let weight = 1 - toCenter.magnitude / visionRange;
      weight = curveWeight(weight, 2, 0.2);

      const clockwiseDist = (directionToCenter - headingPrincipalValue + Math.PI * 2) % (Math.PI * 2);
      const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

      if (clockwiseDist > counterclockwiseDist) {
         // Turn clockwise
         angularVelocity -= turnRate * cohesionInfluence * weight * TURN_CONSTANT;
      } else {
         // Turn counterclockwise
         angularVelocity += turnRate * cohesionInfluence * weight * TURN_CONSTANT;
      }
   }

   // Wall avoidance (turn away from the nearest wall)

   {
   
      // Start by finding the direction to the nearest wall

      // The rotation to try and get away from
      let directionToNearestWall!: number;
      let distanceFromWall!: number;

      // Top wall
      if (entity.position.y >= SettingsConst.BOARD_DIMENSIONS * SettingsConst.TILE_SIZE - visionRange) {
         directionToNearestWall = Math.PI / 2;
         distanceFromWall = SettingsConst.BOARD_DIMENSIONS * SettingsConst.TILE_SIZE - entity.position.y;
      // Right wall
      } else if (entity.position.x >= SettingsConst.BOARD_DIMENSIONS * SettingsConst.TILE_SIZE - visionRange) {
         directionToNearestWall = 0;
         distanceFromWall = SettingsConst.BOARD_DIMENSIONS * SettingsConst.TILE_SIZE - entity.position.x;
      // Bottom wall
      } else if (entity.position.y <= visionRange) {
         directionToNearestWall = Math.PI * 3 / 2;
         distanceFromWall = entity.position.y;
      // Left wall
      } else if (entity.position.x <= visionRange) {
         directionToNearestWall = Math.PI;
         distanceFromWall = entity.position.x;
      }

      if (typeof directionToNearestWall !== "undefined") {
         // Calculate the direction to turn
         const clockwiseDist = (directionToNearestWall - headingPrincipalValue + Math.PI * 2) % (Math.PI * 2);
         const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

         // Direction to turn (1 or -1)
         let turnDirection: number;
         if (counterclockwiseDist > clockwiseDist) {
            // Turn clockwise
            turnDirection = -1;
         } else {
            // Turn counterclockwise
            turnDirection = 1;
         }
         
         // Calculate turn direction weight
         let angleDifference: number;
         if (directionToNearestWall < headingPrincipalValue) {
            angleDifference = Math.min(Math.abs(directionToNearestWall - headingPrincipalValue), Math.abs(directionToNearestWall + Math.PI * 2 - headingPrincipalValue))
         } else {
            angleDifference = Math.min(Math.abs(headingPrincipalValue - directionToNearestWall), Math.abs(headingPrincipalValue + Math.PI * 2 - directionToNearestWall))
         }
         let turnDirectionWeight = angleDifference / Math.PI;
         turnDirectionWeight = curveWeight(turnDirectionWeight, 2, 0.2);

         // Calculate distance from wall weight
         let distanceWeight = 1 - distanceFromWall / visionRange;
         distanceWeight = curveWeight(distanceWeight, 2, 0.2);

         const wallAvoidanceInfluence = Math.max(separationInfluence, alignmentInfluence, cohesionInfluence) * WALL_AVOIDANCE_MULTIPLIER;
         angularVelocity += turnRate * turnDirection * wallAvoidanceInfluence * turnDirectionWeight * distanceWeight * TURN_CONSTANT;
      }
   }

   entity.rotation += angularVelocity;
   entity.hitboxesAreDirty = true;
}

/** Gets all tiles within a given distance from a position */
export function getPositionRadialTiles(position: Point, radius: number): Array<Tile> {
   const tiles = new Array<Tile>();

   const minTileX = Math.max(Math.min(Math.floor((position.x - radius) / SettingsConst.TILE_SIZE), SettingsConst.BOARD_DIMENSIONS - 1), 0);
   const maxTileX = Math.max(Math.min(Math.floor((position.x + radius) / SettingsConst.TILE_SIZE), SettingsConst.BOARD_DIMENSIONS - 1), 0);
   const minTileY = Math.max(Math.min(Math.floor((position.y - radius) / SettingsConst.TILE_SIZE), SettingsConst.BOARD_DIMENSIONS - 1), 0);
   const maxTileY = Math.max(Math.min(Math.floor((position.y + radius) / SettingsConst.TILE_SIZE), SettingsConst.BOARD_DIMENSIONS - 1), 0);

   const radiusSquared = Math.pow(radius, 2);

   for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
      for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
         const tile = Board.getTile(tileX, tileY);

         // Don't try to wander to wall tiles or water
         if (tile.isWall || tile.type === TileTypeConst.water) continue;

         const distanceSquared = Math.pow(position.x - tileX * SettingsConst.TILE_SIZE, 2) + Math.pow(position.y - tileY * SettingsConst.TILE_SIZE, 2);
         if (distanceSquared <= radiusSquared) {
            tiles.push(tile);
         }
      }
   }

   return tiles;
}

/** Gets all tiles within a given distance from a position */
export function getAllowedPositionRadialTiles(position: Point, radius: number, validTileTargets: ReadonlyArray<TileTypeConst>): Array<Tile> {
   const tiles = new Array<Tile>();

   const minTileX = Math.max(Math.min(Math.floor((position.x - radius) / SettingsConst.TILE_SIZE), SettingsConst.BOARD_DIMENSIONS - 1), 0);
   const maxTileX = Math.max(Math.min(Math.floor((position.x + radius) / SettingsConst.TILE_SIZE), SettingsConst.BOARD_DIMENSIONS - 1), 0);
   const minTileY = Math.max(Math.min(Math.floor((position.y - radius) / SettingsConst.TILE_SIZE), SettingsConst.BOARD_DIMENSIONS - 1), 0);
   const maxTileY = Math.max(Math.min(Math.floor((position.y + radius) / SettingsConst.TILE_SIZE), SettingsConst.BOARD_DIMENSIONS - 1), 0);

   const radiusSquared = Math.pow(radius, 2);

   for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
      for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
         const tile = Board.getTile(tileX, tileY);

         // Don't try to wander to wall tiles or disallowed tiles
         if (tile.isWall || validTileTargets.indexOf(tile.type) === -1) continue;

         const distanceSquared = Math.pow(position.x - tileX * SettingsConst.TILE_SIZE, 2) + Math.pow(position.y - tileY * SettingsConst.TILE_SIZE, 2);
         if (distanceSquared <= radiusSquared) {
            tiles.push(tile);
         }
      }
   }

   return tiles;
}

export function entityIsInVisionRange(position: Point, visionRange: number, entity: Entity): boolean {
   if (Math.pow(position.x - entity.position.x, 2) + Math.pow(position.y - entity.position.y, 2) <= Math.pow(visionRange, 2)) {
      return true;
   }

   testCircularHitbox.radius = visionRange;
   testCircularHitbox.object.position.x = position.x;
   testCircularHitbox.object.position.y = position.y;

   // If the test hitbox can 'see' any of the game object's hitboxes, it is visible
   for (const hitbox of entity.hitboxes) {
      if (testCircularHitbox.isColliding(hitbox)) {
         return true;
      }
   }

   return false;
}

export function getEntitiesInVisionRange(x: number, y: number, visionRange: number): Array<Entity> {
   const minChunkX = Math.max(Math.min(Math.floor((x - visionRange) / SettingsConst.TILE_SIZE / SettingsConst.CHUNK_SIZE), SettingsConst.BOARD_SIZE - 1), 0);
   const maxChunkX = Math.max(Math.min(Math.floor((x + visionRange) / SettingsConst.TILE_SIZE / SettingsConst.CHUNK_SIZE), SettingsConst.BOARD_SIZE - 1), 0);
   const minChunkY = Math.max(Math.min(Math.floor((y - visionRange) / SettingsConst.TILE_SIZE / SettingsConst.CHUNK_SIZE), SettingsConst.BOARD_SIZE - 1), 0);
   const maxChunkY = Math.max(Math.min(Math.floor((y + visionRange) / SettingsConst.TILE_SIZE / SettingsConst.CHUNK_SIZE), SettingsConst.BOARD_SIZE - 1), 0);

   testCircularHitbox.radius = visionRange;
   testCircularHitbox.object.position.x = x;
   testCircularHitbox.object.position.y = y;

   const visionRangeSquared = Math.pow(visionRange, 2);
   
   const seenIDs = new Set<number>();
   const entities = new Array<Entity>();
   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);
         for (const entity of chunk.entities) {
            // Don't add existing game objects
            if (seenIDs.has(entity.id)) {
               continue;
            }

            if (Math.pow(x - entity.position.x, 2) + Math.pow(y - entity.position.y, 2) <= visionRangeSquared) {
               entities.push(entity);
               seenIDs.add(entity.id);
               continue;
            }

            // If the test hitbox can 'see' any of the game object's hitboxes, it is visible
            for (const hitbox of entity.hitboxes) {
               if (testCircularHitbox.isColliding(hitbox)) {
                  entities.push(entity);
                  seenIDs.add(entity.id);
                  break;
               }
            }
         }
      }  
   }

   return entities;
}

export function getAngleDifference(angle1: number, angle2: number): number {
   let angleDifference = angle1 - angle2;
   if (angleDifference >= Math.PI) {
      angleDifference -= Math.PI * 2;
   } else if (angleDifference < -Math.PI) {
      angleDifference += Math.PI * 2;
   }
   return angleDifference;
}

export function cleanAngle(angle: number): number {
   return angle - 2 * Math.PI * Math.floor(angle / (2 * Math.PI));
}

export function getAngleDiff(sourceAngle: number, targetAngle: number): number {
   let a = targetAngle - sourceAngle;
   a = Math.abs((a + Math.PI) % (Math.PI * 2)) - Math.PI;
   return a;
}

export function getMinAngleToCircularHitbox(x: number, y: number, hitbox: CircularHitbox): number {
   const xDiff = hitbox.object.position.x + hitbox.rotatedOffsetX - x;
   const yDiff = hitbox.object.position.y + hitbox.rotatedOffsetY - y;

   const angleToHitboxCenter = angle(xDiff, yDiff);
   
   const leftXDiff = xDiff + hitbox.radius * Math.sin(angleToHitboxCenter - Math.PI/2);
   const leftYDiff = yDiff + hitbox.radius * Math.cos(angleToHitboxCenter - Math.PI/2);

   return angle(leftXDiff, leftYDiff);
}

export function getMaxAngleToCircularHitbox(x: number, y: number, hitbox: CircularHitbox): number {
   const xDiff = hitbox.object.position.x + hitbox.rotatedOffsetX - x;
   const yDiff = hitbox.object.position.y + hitbox.rotatedOffsetY - y;

   const angleToHitboxCenter = angle(xDiff, yDiff);
   
   const rightXDiff = xDiff + hitbox.radius * Math.sin(angleToHitboxCenter + Math.PI/2);
   const rightYDiff = yDiff + hitbox.radius * Math.cos(angleToHitboxCenter + Math.PI/2);

   return angle(rightXDiff, rightYDiff);
}

export function getMinAngleToRectangularHitbox(x: number, y: number, hitbox: RectangularHitbox): number {
   let minAngle = 99999.9;
   for (let i = 0; i < 4; i++) {
      const vertexOffset = hitbox.vertexOffsets[i];

      const vertexX = hitbox.object.position.x + hitbox.rotatedOffsetX + vertexOffset.x;
      const vertexY = hitbox.object.position.y + hitbox.rotatedOffsetY + vertexOffset.y;

      const angleToVertex = angle(vertexX - x, vertexY - y);
      if (angleToVertex < minAngle) {
         minAngle = angleToVertex;
      }
   }

   return minAngle;
}

export function getMaxAngleToRectangularHitbox(x: number, y: number, hitbox: RectangularHitbox): number {
   let maxAngle = -99999.9;
   for (let i = 0; i < 4; i++) {
      const vertexOffset = hitbox.vertexOffsets[i];

      const vertexX = hitbox.object.position.x + hitbox.rotatedOffsetX + vertexOffset.x;
      const vertexY = hitbox.object.position.y + hitbox.rotatedOffsetY + vertexOffset.y;

      const angleToVertex = angle(vertexX - x, vertexY - y);
      if (angleToVertex > maxAngle) {
         maxAngle = angleToVertex;
      }
   }

   return maxAngle;
}

/** Calculates the minimum angle startAngle would need to turn to reach endAngle */
export function getClockwiseAngleDistance(startAngle: number, endAngle: number): number {
   let angle = endAngle - startAngle;
   if (angle < 0) {
      angle += 2 * Math.PI;
   }
   return angle;
}

export function angleIsInRange(angle: number, minAngle: number, maxAngle: number): boolean {
   const distFromMinToAngle = getClockwiseAngleDistance(minAngle, angle);
   const distFromMinToMax = getClockwiseAngleDistance(minAngle, maxAngle);

   // The angle is in the range if the distance to the angle is shorter than the distance to the max
   return distFromMinToAngle < distFromMinToMax;
}

export function turnAngle(angle: number, targetAngle: number, turnSpeed: number): number {
   const clockwiseDist = getClockwiseAngleDistance(angle, targetAngle);
   if (clockwiseDist < Math.PI) {
      // Turn clockwise
      let result = angle + turnSpeed * SettingsConst.I_TPS;
      if (result > targetAngle) {
         result = targetAngle;
      }
      return result;
   } else {
      // Turn counterclockwise
      let result = angle - turnSpeed * SettingsConst.I_TPS;
      if (result < targetAngle) {
         result = targetAngle;
      }
      return result;
   }
}