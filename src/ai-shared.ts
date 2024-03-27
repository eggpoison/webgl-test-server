import { SettingsConst, Point, TileTypeConst, angle, curveWeight, lerp, rotateXAroundPoint, rotateYAroundPoint, IEntityType, HitboxCollisionTypeConst, distance, distBetweenPointAndRectangle } from "webgl-test-shared";
import Board, { raytraceHasWallTile } from "./Board";
import Tile from "./Tile";
import CircularHitbox from "./hitboxes/CircularHitbox";
import Entity from "./Entity";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import { PhysicsComponentArray } from "./components/PhysicsComponent";
import { CollisionVars, entitiesAreColliding } from "./collision";

const TURN_CONSTANT = Math.PI / SettingsConst.TPS;
const WALL_AVOIDANCE_MULTIPLIER = 1.5;
   
const testCircularHitbox = new CircularHitbox(0, 0, 1, 0, 0, HitboxCollisionTypeConst.soft, -1, 1, 0);

// @Cleanup: Only used in tribesman.ts, so move there.
export function getClosestAccessibleEntity(entity: Entity, entities: ReadonlyArray<Entity>): Entity {
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
   if (entitiesAreColliding(entity, itemEntity) !== CollisionVars.NO_COLLISION) {
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
      const physicsComponent = PhysicsComponentArray.getComponent(entity.id);
      physicsComponent.hitboxesAreDirty = true;
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
   
   const physicsComponent = PhysicsComponentArray.getComponent(entity.id);
   physicsComponent.hitboxesAreDirty = true;
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
   testCircularHitbox.x = position.x;
   testCircularHitbox.y = position.y;

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
   testCircularHitbox.x = x;
   testCircularHitbox.y = y;

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
   const xDiff = hitbox.x - x;
   const yDiff = hitbox.y - y;

   const angleToHitboxCenter = angle(xDiff, yDiff);
   
   const leftXDiff = xDiff + hitbox.radius * Math.sin(angleToHitboxCenter - Math.PI/2);
   const leftYDiff = yDiff + hitbox.radius * Math.cos(angleToHitboxCenter - Math.PI/2);

   return angle(leftXDiff, leftYDiff);
}

export function getMaxAngleToCircularHitbox(x: number, y: number, hitbox: CircularHitbox): number {
   const xDiff = hitbox.x - x;
   const yDiff = hitbox.y - y;

   const angleToHitboxCenter = angle(xDiff, yDiff);
   
   const rightXDiff = xDiff + hitbox.radius * Math.sin(angleToHitboxCenter + Math.PI/2);
   const rightYDiff = yDiff + hitbox.radius * Math.cos(angleToHitboxCenter + Math.PI/2);

   return angle(rightXDiff, rightYDiff);
}

export function getMinAngleToRectangularHitbox(x: number, y: number, hitbox: RectangularHitbox): number {
   let minAngle = 99999.9;
   for (let i = 0; i < 4; i++) {
      const vertexOffset = hitbox.vertexOffsets[i];

      const vertexX = hitbox.x + vertexOffset.x;
      const vertexY = hitbox.y + vertexOffset.y;

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

      const vertexX = hitbox.x + vertexOffset.x;
      const vertexY = hitbox.y + vertexOffset.y;

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

export function getTurnSmoothingMultiplier(entity: Entity, targetDirection: number): number {
   const dotProduct = Math.sin(entity.rotation) * Math.sin(targetDirection) + Math.cos(entity.rotation) * Math.cos(targetDirection);
   if (dotProduct <= 0) {
      // Turn at full speed when facing away from the direction
      return 1;
   } else {
      // Turn slower the closer the entity is to their desired direction
      return lerp(1, 0.4, dotProduct);
   }
}

export function turnAngle(angle: number, targetAngle: number, turnSpeed: number): number {
   const clockwiseDist = getClockwiseAngleDistance(angle, targetAngle);
   if (clockwiseDist < Math.PI) {
      // Turn clockwise
      let result = angle + turnSpeed * SettingsConst.I_TPS;
      // @Incomplete: Will this sometimes cause snapping?
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

const lineIntersectsRectangularHitbox = (lineX1: number, lineY1: number, lineX2: number, lineY2: number, hitbox: RectangularHitbox): boolean => {
   const rectPosX = hitbox.x;
   const rectPosY = hitbox.y;
   
   // Rotate the line and rectangle to axis-align the rectangle
   const rectRotation = hitbox.rotation;
   const x1 = rotateXAroundPoint(lineX1, lineY1, rectPosX, rectPosY, -rectRotation);
   const y1 = rotateYAroundPoint(lineX1, lineY1, rectPosX, rectPosY, -rectRotation);
   const x2 = rotateXAroundPoint(lineX2, lineY2, rectPosX, rectPosY, -rectRotation);
   const y2 = rotateYAroundPoint(lineX2, lineY2, rectPosX, rectPosY, -rectRotation);

   const xMin = Math.min(x1, x2);
   const xMax = Math.max(x1, x2);
   const yMin = Math.min(y1, y2);
   const yMax = Math.max(y1, y2);
   
   if (rectPosX - hitbox.width / 2 > xMax || rectPosX + hitbox.width / 2 < xMin) {
      return false;
   } 
   
   if (rectPosY - hitbox.height / 2 > yMax || rectPosY + hitbox.height / 2 < yMin) {
      return false;
   }

   const yAtRectLeft = y1 + (y2 - y1) * ((rectPosX - hitbox.width / 2 - x1) / (x2 - x1));
   const yAtRectRight = y1 + (y2 - y1) * ((rectPosX + hitbox.width / 2 - x1) / (x2 - x1));

   if (rectPosY - hitbox.height / 2 > yAtRectLeft && rectPosY - hitbox.height / 2 > yAtRectRight) {
      return false;
   }

   if (rectPosY + hitbox.height / 2 < yAtRectLeft && rectPosY + hitbox.height / 2 < yAtRectRight) {
      return false;
   }

   return true;
}

const entityAffectsLineOfSight = (entityType: IEntityType): boolean => {
   return entityType !== IEntityType.woodenArrowProjectile;
}

const lineIntersectsCircularHitbox = (lineX1: number, lineY1: number, lineX2: number, lineY2: number, hitbox: CircularHitbox): boolean => {
   // https://stackoverflow.com/questions/67116296/is-this-code-for-determining-if-a-circle-and-line-segment-intersects-correct
   
   const circleX = hitbox.x;
   const circleY = hitbox.y;
   
   let x_linear = lineX2 - lineX1;
   let x_constant = lineX1 - circleX;
   let y_linear = lineY2 - lineY1;
   let y_constant = lineY1 - circleY;
   let a = x_linear * x_linear + y_linear * y_linear;
   let half_b = x_linear * x_constant + y_linear * y_constant;
   let c = x_constant * x_constant + y_constant * y_constant - hitbox.radius * hitbox.radius;
   return (
      half_b * half_b >= a * c &&
      (-half_b <= a || c + half_b + half_b + a <= 0) &&
      (half_b <= 0 || c <= 0)
   );
}

const entityIntersectsLineOfSight = (entity: Entity, originEntity: Entity, targetEntity: Entity): boolean => {
   for (let i = 0; i < entity.hitboxes.length; i++) {
      const hitbox = entity.hitboxes[i];

      // @Hack
      // Ignore the horizontal hitboxes of embrasures
      if (entity.type === IEntityType.embrasure && i > 1) {
         continue;
      }

      if (hitbox.hasOwnProperty("radius")) {
         if (lineIntersectsCircularHitbox(originEntity.position.x, originEntity.position.y, targetEntity.position.x, targetEntity.position.y, hitbox as CircularHitbox)) {
            return false;
         }
      } else {
         if (lineIntersectsRectangularHitbox(originEntity.position.x, originEntity.position.y, targetEntity.position.x, targetEntity.position.y, hitbox as RectangularHitbox)) {
            return true;
         }
      }
   }

   return false;
}

export function entityIsInLineOfSight(originEntity: Entity, targetEntity: Entity, ignoredEntityIDs: ReadonlyArray<number>): boolean {
   // 
   // Check for entity hitboxes in the path between
   // 

   const minX = Math.min(originEntity.position.x, targetEntity.position.x);
   const maxX = Math.max(originEntity.position.x, targetEntity.position.x);
   const minY = Math.min(originEntity.position.y, targetEntity.position.y);
   const maxY = Math.max(originEntity.position.y, targetEntity.position.y);

   const minChunkX = Math.floor(minX / SettingsConst.CHUNK_UNITS);
   const maxChunkX = Math.floor(maxX / SettingsConst.CHUNK_UNITS);
   const minChunkY = Math.floor(minY / SettingsConst.CHUNK_UNITS);
   const maxChunkY = Math.floor(maxY / SettingsConst.CHUNK_UNITS);

   for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
         const chunk = Board.getChunk(chunkX, chunkY);

         for (let i = 0; i < chunk.entities.length; i++) {
            const entity = chunk.entities[i];
            if (entity === originEntity || entity === targetEntity || ignoredEntityIDs.includes(entity.id) || !entityAffectsLineOfSight(entity.type)) {
               continue;
            }

            if (entityIntersectsLineOfSight(entity, originEntity, targetEntity)) {
               return false;
            }
         }
      }
   }
   
   // Check for walls in between
   if (raytraceHasWallTile(originEntity.position.x, originEntity.position.y, targetEntity.position.x, targetEntity.position.y)) {
      return false;
   }

   return true;
}

export function getDistanceFromPointToEntity(x: number, y: number, entity: Entity): number {
   let minDistance = Math.sqrt(Math.pow(x - entity.position.x, 2) + Math.pow(y - entity.position.y, 2));
   for (const hitbox of entity.hitboxes) {
      if (hitbox.hasOwnProperty("radius")) {
         const rawDistance = distance(x, y, hitbox.x, hitbox.y);
         const hitboxDistance = rawDistance - (hitbox as CircularHitbox).radius;
         if (hitboxDistance < minDistance) {
            minDistance = hitboxDistance;
         }
      } else {
         let dist = distBetweenPointAndRectangle(x, y, hitbox.x, hitbox.y, (hitbox as RectangularHitbox).width, (hitbox as RectangularHitbox).height, (hitbox as RectangularHitbox).rotation);
         if (dist < minDistance) {
            minDistance = dist;
         }
      }
   }
   return minDistance;
}