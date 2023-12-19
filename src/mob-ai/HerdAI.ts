import { angle, curveWeight, EntityTypeConst, Point, SETTINGS } from "webgl-test-shared";
// import Entity from "../entities/Entity";
// import Mob from "../entities/mobs/Mob";
// import AI from "./AI";
import { MobAIType } from "../mob-ai-types";

// interface HerdAIParams {
//    readonly acceleration: number;
//    readonly terminalVelocity: number;
//    /** Minimum distance from other members to try and maintain */
//    readonly minSeperationDistance: number;
//    /** Rate at which the mob turns */
//    readonly turnRate: number;
//    /** Minimum number of entities that can activate the AI */
//    readonly minActivateAmount: number;
//    /** Maximum number of entities that can activate the AI */
//    readonly maxActivateAmount: number;
//    /** Mobs which can be classified as herd members */
//    readonly validHerdMembers: ReadonlySet<EntityTypeConst>;
//    /** How much the mob will try and avoid being too close to nearby herd members */
//    readonly seperationInfluence: number;
//    /** How much the mob will try to align its direction with other nearby herd members */
//    readonly alignmentInfluence: number;
//    /** How much the mob will try to move to the local center of mass */
//    readonly cohesionInfluence: number;
// }

// class HerdAI extends AI implements HerdAIParams {
//    private static readonly WALL_AVOIDANCE_MULTIPLIER = 1.5;
//    private static readonly TURN_CONSTANT = Math.PI / SETTINGS.TPS;

//    public readonly type = MobAIType.herd;
   
//    public readonly acceleration: number;
//    public readonly terminalVelocity: number;
//    public readonly minSeperationDistance: number;
//    public readonly turnRate: number;
//    public readonly validHerdMembers: ReadonlySet<EntityTypeConst>;
//    readonly minActivateAmount: number;
//    readonly maxActivateAmount: number;
//    public readonly seperationInfluence: number;
//    public readonly alignmentInfluence: number;
//    public readonly cohesionInfluence: number;
//    private readonly wallAvoidanceInfluence: number;
 
//    /** Amount of radians to add to the mob's rotation each tick */
//    private angularVelocity = 0;

//    constructor(mob: Mob, aiParams: HerdAIParams) {
//       super(mob);
      
//       this.acceleration = aiParams.acceleration;
//       this.terminalVelocity = aiParams.terminalVelocity;
//       this.minSeperationDistance = aiParams.minSeperationDistance;
//       this.turnRate = aiParams.turnRate;
//       this.validHerdMembers = aiParams.validHerdMembers;
//       this.minActivateAmount = aiParams.minActivateAmount;
//       this.maxActivateAmount = aiParams.maxActivateAmount;
//       this.seperationInfluence = aiParams.seperationInfluence;
//       this.alignmentInfluence = aiParams.alignmentInfluence;
//       this.cohesionInfluence = aiParams.cohesionInfluence;

//       this.wallAvoidanceInfluence = Math.max(aiParams.seperationInfluence, aiParams.alignmentInfluence, aiParams.cohesionInfluence) * HerdAI.WALL_AVOIDANCE_MULTIPLIER;
//    }

//    public onRefresh(): void {
//       // 
//       // Find the closest herd member and calculate other data
//       // 

//       // Average angle of nearby entities
//       let totalXVal: number = 0;
//       let totalYVal: number = 0;

//       let centerX = 0;
//       let centerY = 0;

//       let closestHerdMember: Entity | undefined;
//       let minDist = Number.MAX_SAFE_INTEGER;
//       let numHerdMembers = 0;
//       for (const entity of this.mob.visibleEntities) {
//          if (this.entityIsInHerd(entity)) {
//             const distance = this.mob.position.calculateDistanceBetween(entity.position);
//             if (distance < minDist) {
//                closestHerdMember = entity;
//                minDist = distance;
//             }

//             totalXVal += Math.sin(entity.rotation);
//             totalYVal += Math.cos(entity.rotation);

//             centerX += entity.position.x;
//             centerY += entity.position.y;
//             numHerdMembers++;
//          }
//       }
//       if (typeof closestHerdMember === "undefined") {
//          return;
//       }

//       centerX /= numHerdMembers;
//       centerY /= numHerdMembers;

//       this.angularVelocity = 0;
      
//       const headingPrincipalValue = ((this.mob.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      
//       // SEPARATION
//       // Steer away from herd members who are too close
//       if (minDist < this.minSeperationDistance) {
//          // Calculate the weight of the separation
//          let weight = 1 - minDist / this.minSeperationDistance;
//          weight = curveWeight(weight, 2, 0.2);
         
//          // @Speed: Garbage collection
//          const distanceVector = closestHerdMember.position.convertToVector(this.mob.position);

//          const clockwiseDist = (distanceVector.direction - this.mob.rotation + Math.PI * 2) % (Math.PI * 2);
//          const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

//          if (clockwiseDist > counterclockwiseDist) {
//             // Turn clockwise
//             this.angularVelocity += this.turnRate * this.seperationInfluence * weight * HerdAI.TURN_CONSTANT;
//          } else {
//             // Turn counterclockwise
//             this.angularVelocity -= this.turnRate * this.seperationInfluence * weight * HerdAI.TURN_CONSTANT;
//          }
//       }

//       // ALIGNMENT
//       // Orientate to nearby herd members' headings

//       {
//          let averageHeading = angle(totalXVal, totalYVal);
//          if (averageHeading < 0) {
//             averageHeading += Math.PI * 2;
//          }

//          // Calculate the weight of the alignment
//          let angleDifference: number;
//          if (averageHeading < headingPrincipalValue) {
//             angleDifference = Math.min(Math.abs(averageHeading - headingPrincipalValue), Math.abs(averageHeading + Math.PI * 2 - headingPrincipalValue))
//          } else {
//             angleDifference = Math.min(Math.abs(headingPrincipalValue - averageHeading), Math.abs(headingPrincipalValue + Math.PI * 2 - averageHeading))
//          }
//          let weight = angleDifference / Math.PI;
//          weight = curveWeight(weight, 2, 0.1);
         
//          const clockwiseDist = (averageHeading - headingPrincipalValue + Math.PI * 2) % (Math.PI * 2);
//          const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

//          if (clockwiseDist < counterclockwiseDist) {
//             // Turn clockwise
//             this.angularVelocity += this.turnRate * this.alignmentInfluence * weight * HerdAI.TURN_CONSTANT;
//          } else {
//             // Turn counterclockwise
//             this.angularVelocity -= this.turnRate * this.alignmentInfluence * weight * HerdAI.TURN_CONSTANT;
//          }

//       }

//       // COHESION
//       // Steer to move towards the local center of mass
      
//       {
//          // @Speed: Garbage collection
         
//          // Calculate average position
//          const centerOfMass = new Point(centerX, centerY);
         
//          const toCenter = centerOfMass.convertToVector(this.mob.position);
//          const directionToCenter = ((toCenter.direction % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

//          let weight = 1 - toCenter.magnitude / this.mob.visionRange;
//          weight = curveWeight(weight, 2, 0.2);

//          const clockwiseDist = (directionToCenter - headingPrincipalValue + Math.PI * 2) % (Math.PI * 2);
//          const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

//          if (clockwiseDist > counterclockwiseDist) {
//             // Turn clockwise
//             this.angularVelocity -= this.turnRate * this.cohesionInfluence * weight * HerdAI.TURN_CONSTANT;
//          } else {
//             // Turn counterclockwise
//             this.angularVelocity += this.turnRate * this.cohesionInfluence * weight * HerdAI.TURN_CONSTANT;
//          }
//       }

//       // Wall avoidance (turn away from the nearest wall)

//       {
      
//          // Start by finding the direction to the nearest wall

//          // The rotation to try and get away from
//          let directionToNearestWall!: number;
//          let distanceFromWall!: number;

//          // Top wall
//          if (this.mob.position.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - this.mob.visionRange) {
//             directionToNearestWall = Math.PI / 2;
//             distanceFromWall = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - this.mob.position.y;
//          // Right wall
//          } else if (this.mob.position.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - this.mob.visionRange) {
//             directionToNearestWall = 0;
//             distanceFromWall = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - this.mob.position.x;
//          // Bottom wall
//          } else if (this.mob.position.y <= this.mob.visionRange) {
//             directionToNearestWall = Math.PI * 3 / 2;
//             distanceFromWall = this.mob.position.y;
//          // Left wall
//          } else if (this.mob.position.x <= this.mob.visionRange) {
//             directionToNearestWall = Math.PI;
//             distanceFromWall = this.mob.position.x;
//          }

//          if (typeof directionToNearestWall !== "undefined") {
//             // Calculate the direction to turn
//             const clockwiseDist = (directionToNearestWall - headingPrincipalValue + Math.PI * 2) % (Math.PI * 2);
//             const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

//             // Direction to turn (1 or -1)
//             let turnDirection: number;
//             if (counterclockwiseDist > clockwiseDist) {
//                // Turn clockwise
//                turnDirection = -1;
//             } else {
//                // Turn counterclockwise
//                turnDirection = 1;
//             }
            
//             // Calculate turn direction weight
//             let angleDifference: number;
//             if (directionToNearestWall < headingPrincipalValue) {
//                angleDifference = Math.min(Math.abs(directionToNearestWall - headingPrincipalValue), Math.abs(directionToNearestWall + Math.PI * 2 - headingPrincipalValue))
//             } else {
//                angleDifference = Math.min(Math.abs(headingPrincipalValue - directionToNearestWall), Math.abs(headingPrincipalValue + Math.PI * 2 - directionToNearestWall))
//             }
//             let turnDirectionWeight = angleDifference / Math.PI;
//             turnDirectionWeight = curveWeight(turnDirectionWeight, 2, 0.2);

//             // Calculate distance from wall weight
//             let distanceWeight = 1 - distanceFromWall / this.mob.visionRange;
//             distanceWeight = curveWeight(distanceWeight, 2, 0.2);

//             this.angularVelocity += this.turnRate * turnDirection * this.wallAvoidanceInfluence * turnDirectionWeight * distanceWeight * HerdAI.TURN_CONSTANT;
//          }
//       }
//    }

//    public tick(): void {
//       this.mob.rotation += this.angularVelocity;
//       this.mob.acceleration.x = this.acceleration * Math.sin(this.mob.rotation);
//       this.mob.acceleration.y = this.acceleration * Math.cos(this.mob.rotation);
//       this.mob.terminalVelocity = this.terminalVelocity;
//    }

//    private entityIsInHerd(entity: Entity): boolean {
//       return this.validHerdMembers.has(entity.type) && (this.mob.herdMemberHash === -1 || (entity.type === this.mob.type && (entity as Mob).herdMemberHash === this.mob.herdMemberHash));
//    }

//    public canSwitch(): boolean {
//       let numHerdMembers = 0;
//       for (const entity of this.mob.visibleEntities) {
//          // Make sure the entity has a valid entity type and a valid herd member hash
//          if (this.entityIsInHerd(entity)) {
//             numHerdMembers++;
//          }
//       }
//       return numHerdMembers >= this.minActivateAmount && numHerdMembers <= this.maxActivateAmount;
//    }
// }

// export default HerdAI;