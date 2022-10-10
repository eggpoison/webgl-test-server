// import { Point, SETTINGS } from "webgl-test-shared";
// import Entity from "../entities/Entity";
// import PassiveMobAI, { PassiveMobAIInfo } from "./PassiveMobAI";

// interface HerdPassiveMobAIInfo extends PassiveMobAIInfo {
//    readonly minHerdMemberDistance: number;
//    /** Amount of radians that the entity can turn in a second */
//    readonly turnSpeed: number;
//    readonly herdValidationFunction: (entity: Entity) => boolean;
// }

// class HerdPassiveMobAI extends PassiveMobAI {
//    private static readonly SEPARATION_WEIGHT = 0.7;
//    private static readonly ALIGNMENT_WEIGHT = 0.5;
//    private static readonly COHESION_WEIGHT = 0.8;

//    private readonly minHerdMemberDistance: number;
//    private readonly turnSpeed: number;
//    private readonly herdValidationFunction: (entity: Entity) => boolean;

//    private readonly TURN_CONSTANT: number;

//    constructor(entity: Entity, info: HerdPassiveMobAIInfo) {
//       super(entity, info);

//       this.minHerdMemberDistance = info.minHerdMemberDistance;
//       this.turnSpeed = info.turnSpeed;
//       this.herdValidationFunction = info.herdValidationFunction;

//       this.TURN_CONSTANT = Math.PI * this.turnSpeed / SETTINGS.TPS;
//    }

//    public tick(): void {
//       // 
//       // Prioritise the herd AI first, then wandering second
//       // 
      
//       const nearbyEntities = super.getEntitiesInRadius(this.visionRange);
//       const nearbyHerdMembers = this.filterHerdMembers(nearbyEntities);

//       // If there are no herd members nearby then default to the regular passive mob AI
//       if (nearbyHerdMembers.length === 0) {
//          super.tick();
//          return;
//       }

//       const entityRotation = ((this.entity.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

//       // SEPARATION
//       // Steer away from herd members who are too close

//       const [closestHerdMember, minHerdMemberDistance] = this.findClosestHerdMember(nearbyHerdMembers);
//       if (minHerdMemberDistance < this.minHerdMemberDistance) {
//          const distanceVector = closestHerdMember.position.convertToVector(this.entity.position);

//          const clockwiseDist = (distanceVector.direction - this.entity.rotation + Math.PI * 2) % (Math.PI * 2);
//          const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

//          if (clockwiseDist > counterclockwiseDist) {
//             // Turn clockwise
//             this.entity.rotation += this.TURN_CONSTANT * HerdPassiveMobAI.SEPARATION_WEIGHT;
//          } else {
//             // Turn counterclockwise
//             this.entity.rotation -= this.TURN_CONSTANT * HerdPassiveMobAI.SEPARATION_WEIGHT;
//          }
//       }

//       // ALIGNMENT
//       // Orientate to nearby herd members' headings
      
//       const rotations = nearbyHerdMembers.map(entity => entity.rotation);
//       const rotationY = rotations.reduce((previousValue, currentValue) => previousValue + Math.sin(currentValue), 0);
//       const rotationX = rotations.reduce((previousValue, currentValue) => previousValue + Math.cos(currentValue), 0);
//       let averageHeading = Math.atan2(rotationY, rotationX);
//       averageHeading = ((averageHeading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

//       {
//          const clockwiseDist = (averageHeading - entityRotation + Math.PI * 2) % (Math.PI * 2);
//          const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

//          if (clockwiseDist < counterclockwiseDist) {
//             // Turn clockwise
//             this.entity.rotation += this.TURN_CONSTANT * HerdPassiveMobAI.ALIGNMENT_WEIGHT;
//          } else {
//             // Turn counterclockwise
//             this.entity.rotation -= this.TURN_CONSTANT * HerdPassiveMobAI.ALIGNMENT_WEIGHT;
//          }

//       }

//       // COHESION
//       // Steer to move towards the local center of mass

//       let centerX = 0;
//       let centerY = 0;
//       for (const entity of nearbyHerdMembers) {
//          centerX += entity.position.x;
//          centerY += entity.position.y;
//       }
//       centerX /= nearbyHerdMembers.length;
//       centerY /= nearbyHerdMembers.length;
//       const centerOfMass = new Point(centerX, centerY);

//       const vertexToCenter = centerOfMass.convertToVector(this.entity.position);
//       const directionToCenter = ((vertexToCenter.direction % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

//       const clockwiseDist = (directionToCenter - entityRotation + Math.PI * 2) % (Math.PI * 2);
//       const counterclockwiseDist = (Math.PI * 2) - clockwiseDist;

//       if (clockwiseDist > counterclockwiseDist) {
//          // Turn clockwise
//          this.entity.rotation -= this.TURN_CONSTANT * HerdPassiveMobAI.COHESION_WEIGHT;
//       } else {
//          // Turn counterclockwise
//          this.entity.rotation += this.TURN_CONSTANT * Math.PI / SETTINGS.TPS * HerdPassiveMobAI.COHESION_WEIGHT;
//       }

//       super.moveInDirection(this.entity.rotation, this.wanderAcceleration, this.wanderTerminalVelocity);

//       this.entity.rotation = ((this.entity.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
//    }

//    private filterHerdMembers(entities: ReadonlyArray<Entity>): ReadonlyArray<Entity> {
//       return entities.filter(entity => this.herdValidationFunction(entity));
//    }

//    private findClosestHerdMember(entities: ReadonlyArray<Entity>): [closestHerdMember: Entity, minHerdMemberDistance: number] {
//       let closestHerdMember!: Entity;
//       let minDistance = Number.MAX_SAFE_INTEGER;

//       for (const entity of entities) {
//          const dist = this.entity.position.distanceFrom(entity.position);
//          if (dist < minDistance) {
//             closestHerdMember = entity;
//             minDistance = dist;
//          }
//       }

//       return [closestHerdMember, minDistance];
//    }
// }

// export default HerdPassiveMobAI;