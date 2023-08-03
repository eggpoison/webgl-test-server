import { curveWeight, EntityType, Point, SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";

type InfluenceFalloff = {
   /** Minimum number of entities to begin the falloff */
   readonly start: number;
   /** How many entities until the falloff fully occurs */
   readonly duration: number;
}

interface HerdAIParams extends BaseAIParams<"herd"> {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   /** Minimum distance from other members to try and maintain */
   readonly minSeperationDistance: number;
   /** Rate at which the mob turns */
   readonly turnRate: number;
   /** Maximum number of entities that can have an influence on the AI's weight */
   readonly maxWeightInflenceCount: number;
   readonly weightInfluenceFalloff?: InfluenceFalloff;
   /** Mobs which can be classified as herd members */
   readonly validHerdMembers: ReadonlySet<EntityType>;
   /** How much the mob will try and avoid being too close to nearby herd members */
   readonly seperationInfluence: number;
   /** How much the mob will try to align its direction with other nearby herd members */
   readonly alignmentInfluence: number;
   /** How much the mob will try to move to the local center of mass */
   readonly cohesionInfluence: number;
}

class HerdAI extends AI<"herd"> implements HerdAIParams {
   private static readonly WALL_AVOIDANCE_MULTIPLIER = 1.5;
   private static readonly TURN_CONSTANT = Math.PI / SETTINGS.TPS;

   public readonly type = "herd";
   
   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly minSeperationDistance: number;
   public readonly turnRate: number;
   public readonly validHerdMembers: ReadonlySet<EntityType>;
   public readonly maxWeightInflenceCount: number;
   public readonly weightInfluenceFalloff?: InfluenceFalloff;
   public readonly seperationInfluence: number;
   public readonly alignmentInfluence: number;
   public readonly cohesionInfluence: number;
   private readonly wallAvoidanceInfluence: number;
 
   /** Amount of radians to add to the mob's rotation each tick */
   private angularVelocity = 0;

   constructor(mob: Mob, aiParams: HerdAIParams) {
      super(mob, aiParams);
      
      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.minSeperationDistance = aiParams.minSeperationDistance;
      this.turnRate = aiParams.turnRate;
      this.validHerdMembers = aiParams.validHerdMembers;
      this.maxWeightInflenceCount = aiParams.maxWeightInflenceCount;
      this.weightInfluenceFalloff = aiParams.weightInfluenceFalloff;
      this.seperationInfluence = aiParams.seperationInfluence;
      this.alignmentInfluence = aiParams.alignmentInfluence;
      this.cohesionInfluence = aiParams.cohesionInfluence;

      this.wallAvoidanceInfluence = Math.max(aiParams.seperationInfluence, aiParams.alignmentInfluence, aiParams.cohesionInfluence) * HerdAI.WALL_AVOIDANCE_MULTIPLIER;
   }

   public onRefresh(): void {
      this.angularVelocity = 0;
      
      const headingPrincipalValue = ((this.mob.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

      // SEPARATION
      // Steer away from herd members who are too close
      const [closestHerdMember, distanceToClosestHerdMember] = this.findClosestEntity();
      if (distanceToClosestHerdMember < this.minSeperationDistance) {
         // Calculate the weight of the separation
         let weight = 1 - distanceToClosestHerdMember / this.minSeperationDistance;
         weight = curveWeight(weight, 2, 0.2);
         
         const distanceVector = closestHerdMember.position.convertToVector(this.mob.position);

         const clockwiseDist = (distanceVector.direction - this.mob.rotation + Math.PI * 2) % (Math.PI * 2);
         const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

         if (clockwiseDist > counterclockwiseDist) {
            // Turn clockwise
            this.angularVelocity += this.turnRate * this.seperationInfluence * weight * HerdAI.TURN_CONSTANT;
         } else {
            // Turn counterclockwise
            this.angularVelocity -= this.turnRate * this.seperationInfluence * weight * HerdAI.TURN_CONSTANT;
         }
      }

      // ALIGNMENT
      // Orientate to nearby herd members' headings

      {
         // Calculate the average angle of nearby entities
         let totalXVal: number = 0;
         let totalYVal: number = 0;
         for (const entity of this.entitiesInVisionRange) {
            totalXVal += Math.sin(entity.rotation);
            totalYVal += Math.cos(entity.rotation);
         }
         let averageHeading = Math.atan2(totalYVal, totalXVal);
         averageHeading = Math.PI/2 - averageHeading;
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
            this.angularVelocity += this.turnRate * this.alignmentInfluence * weight * HerdAI.TURN_CONSTANT;
         } else {
            // Turn counterclockwise
            this.angularVelocity -= this.turnRate * this.alignmentInfluence * weight * HerdAI.TURN_CONSTANT;
         }

      }

      // COHESION
      // Steer to move towards the local center of mass
      
      {
         // Calculate average position
         let centerX = 0;
         let centerY = 0;
         for (const entity of this.entitiesInVisionRange) {
            centerX += entity.position.x;
            centerY += entity.position.y;
         }
         centerX /= this.entitiesInVisionRange.size;
         centerY /= this.entitiesInVisionRange.size;
         const centerOfMass = new Point(centerX, centerY);
         
         const toCenter = centerOfMass.convertToVector(this.mob.position);
         const directionToCenter = ((toCenter.direction % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

         let weight = 1 - toCenter.magnitude / this.mob.visionRange;
         weight = curveWeight(weight, 2, 0.2);

         const clockwiseDist = (directionToCenter - headingPrincipalValue + Math.PI * 2) % (Math.PI * 2);
         const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

         if (clockwiseDist > counterclockwiseDist) {
            // Turn clockwise
            this.angularVelocity -= this.turnRate * this.cohesionInfluence * weight * HerdAI.TURN_CONSTANT;
         } else {
            // Turn counterclockwise
            this.angularVelocity += this.turnRate * this.cohesionInfluence * weight * HerdAI.TURN_CONSTANT;
         }
      }

      // Wall avoidance (turn away from the nearest wall)
      // TODO: (problem) Currently this system has priorities over which wall to steer away from, which is a problem in corners
      // Top wall > right wall > bottom wall > left wall

      {
      
         // Start by finding the direction to the nearest wall

         // The rotation to try and get away from
         let directionToNearestWall!: number;
         let distanceFromWall!: number;

         // Top wall
         if (this.mob.position.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - this.mob.visionRange) {
            directionToNearestWall = Math.PI / 2;
            distanceFromWall = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - this.mob.position.y;
         // Right wall
         } else if (this.mob.position.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - this.mob.visionRange) {
            directionToNearestWall = 0;
            distanceFromWall = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - this.mob.position.x;
         // Bottom wall
         } else if (this.mob.position.y <= this.mob.visionRange) {
            directionToNearestWall = Math.PI * 3 / 2;
            distanceFromWall = this.mob.position.y;
         // Left wall
         } else if (this.mob.position.x <= this.mob.visionRange) {
            directionToNearestWall = Math.PI;
            distanceFromWall = this.mob.position.x;
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
            let distanceWeight = 1 - distanceFromWall / this.mob.visionRange;
            distanceWeight = curveWeight(distanceWeight, 2, 0.2);

            this.angularVelocity += this.turnRate * turnDirection * this.wallAvoidanceInfluence * turnDirectionWeight * distanceWeight * HerdAI.TURN_CONSTANT;
         }
      }
   }

   public tick(): void {
      this.mob.rotation += this.angularVelocity;
      this.mob.acceleration = new Vector(this.acceleration, this.mob.rotation);
      this.mob.terminalVelocity = this.terminalVelocity;
   }

   private findClosestEntity(): [closestEntity: Entity, minDistance: number] {
      let minDistance = Number.MAX_SAFE_INTEGER;
      let closestEntity!: Entity;
      for (const entity of this.entitiesInVisionRange) {
         const distance = this.mob.position.calculateDistanceBetween(entity.position);
         if (distance < minDistance) {
            closestEntity = entity;
            minDistance = distance;
         }
      }
      return [closestEntity, minDistance];
   }

   protected filterEntitiesInVisionRange(visibleEntities: ReadonlySet<Entity>): Set<Entity> {
      const filteredEntities = new Set<Entity>();
      for (const entity of visibleEntities) {
         if (this.validHerdMembers.has(entity.type as any)) {
            if (typeof this.mob.herdMemberHash !== "undefined" && entity.type === this.mob.type) {
               if (this.mob.herdMemberHash !== (entity as Mob).herdMemberHash!) {
                  continue;
               }
            }

            filteredEntities.add(entity);
         }
      }

      return filteredEntities;
   }

   protected _getWeight(): number {
      // Weight unaffected by falloff
      let weight = Math.min(this.entitiesInVisionRange.size / this.maxWeightInflenceCount, 1)

      // Clamp the weight to match falloff
      if (typeof this.weightInfluenceFalloff !== "undefined" && this.entitiesInVisionRange.size >= this.weightInfluenceFalloff.start) {
         weight = Math.min(weight, 1 - Math.min((this.entitiesInVisionRange.size - this.weightInfluenceFalloff.start + 1) / this.weightInfluenceFalloff.duration, 1));
      }

      return weight;
   }

   protected _callCallback(callback: () => void): void {
      callback();
   }
}

export default HerdAI;