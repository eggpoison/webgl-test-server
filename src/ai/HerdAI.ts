import { Point, SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob, { MobType } from "../entities/Mob";
import AI, { BaseAIParams } from "./AI";

type InfluenceFalloff = {
   /** Minimum number of entities to begin the falloff */
   readonly start: number;
   /** How many entities until the falloff fully occurs */
   readonly duration: number;
}

interface HerdAIParams extends BaseAIParams {
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
   readonly validHerdMembers: ReadonlySet<MobType>;
   readonly seperationWeight: number;
   readonly alignmentWeight: number;
   readonly cohesionWeight: number;
}

class HerdAI extends AI implements HerdAIParams {
   private static readonly TURN_CONSTANT = Math.PI / SETTINGS.TPS;

   public readonly type = "herd";
   
   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly minSeperationDistance: number;
   public readonly turnRate: number;
   public readonly validHerdMembers: ReadonlySet<MobType>;
   public readonly maxWeightInflenceCount: number;
   public readonly weightInfluenceFalloff?: InfluenceFalloff;
   public readonly seperationWeight: number;
   public readonly alignmentWeight: number;
   public readonly cohesionWeight: number;

   /** Amount of radians to add to the mob's rotation each tick */
   private angularVelocity = 0;

   constructor(mob: Mob, { aiWeightMultiplier, acceleration, terminalVelocity, minSeperationDistance, turnRate, maxWeightInflenceCount, weightInfluenceFalloff, validHerdMembers, seperationWeight, alignmentWeight, cohesionWeight }: HerdAIParams) {
      super(mob, { aiWeightMultiplier });
      
      this.acceleration = acceleration;
      this.terminalVelocity = terminalVelocity;
      this.minSeperationDistance = minSeperationDistance;
      this.turnRate = turnRate;
      this.validHerdMembers = validHerdMembers;
      this.maxWeightInflenceCount = maxWeightInflenceCount;
      this.weightInfluenceFalloff = weightInfluenceFalloff;
      this.seperationWeight = seperationWeight;
      this.alignmentWeight = alignmentWeight;
      this.cohesionWeight = cohesionWeight;
   }

   public onRefresh(): void {
      this.angularVelocity = 0;
      
      const entityRotation = ((this.mob.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

      // SEPARATION
      // Steer away from herd members who are too close
      const [closestHerdMember, minDistance] = this.findClosestEntity();
      if (minDistance < this.minSeperationDistance) {
         const distanceVector = closestHerdMember.position.convertToVector(this.mob.position);

         const clockwiseDist = (distanceVector.direction - this.mob.rotation + Math.PI * 2) % (Math.PI * 2);
         const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

         if (clockwiseDist > counterclockwiseDist) {
            // Turn clockwise
            this.angularVelocity += this.turnRate * this.seperationWeight * HerdAI.TURN_CONSTANT;
         } else {
            // Turn counterclockwise
            this.angularVelocity -= this.turnRate * this.seperationWeight * HerdAI.TURN_CONSTANT;
         }
      }

      // ALIGNMENT
      // Orientate to nearby herd members' headings
      
      // Calculate the average angle of nearby entities
      let totalXVal: number = 0;
      let totalYVal: number = 0;
      for (const entity of this.entitiesInVisionRange) {
         totalXVal += Math.cos(entity.rotation);
         totalYVal += Math.sin(entity.rotation);
      }
      let averageHeading = Math.atan2(totalYVal, totalXVal);
      averageHeading = ((averageHeading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

      {
         const clockwiseDist = (averageHeading - entityRotation + Math.PI * 2) % (Math.PI * 2);
         const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

         if (clockwiseDist < counterclockwiseDist) {
            // Turn clockwise
            this.angularVelocity += this.turnRate * this.alignmentWeight;
         } else {
            // Turn counterclockwise
            this.angularVelocity -= this.turnRate * this.alignmentWeight;
         }

      }

      // COHESION
      // Steer to move towards the local center of mass

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

      const clockwiseDist = (directionToCenter - entityRotation + Math.PI * 2) % (Math.PI * 2);
      const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

      if (clockwiseDist > counterclockwiseDist) {
         // Turn clockwise
         this.angularVelocity -= this.turnRate * this.cohesionWeight * HerdAI.TURN_CONSTANT;
      } else {
         // Turn counterclockwise
         this.angularVelocity += this.turnRate * this.cohesionWeight * HerdAI.TURN_CONSTANT;
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
         const distance = this.mob.position.distanceFrom(entity.position);
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
}

export default HerdAI;