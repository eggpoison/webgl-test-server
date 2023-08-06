import { ParticleType, Point, SETTINGS, Vector } from "webgl-test-shared";
import Chunk from "./Chunk";
import Board from "./Board";

let idCounter = 0;

const getAvailableID = (): number => {
   return idCounter++;
}

export interface ParticleInfo {
   readonly type: ParticleType;
   readonly spawnPosition: Point;
   readonly initialVelocity: Vector | null;
   readonly initialAcceleration: Vector | null;
   readonly initialRotation: number;
   readonly angularVelocity?: number;
   readonly angularAcceleration?: number;
   readonly angularDrag?: number;
   readonly opacity: number | ((age: number) => number);
   readonly scale?: number | ((age: number) => number);
   /** Amount the particle's velocity gets decreased each second */
   readonly drag?: number;
   /** Number of seconds the particle lasts before being destroyed */
   readonly lifetime: number;
}

class Particle {
   public readonly id: number;

   public readonly type: ParticleType;
   
   public position: Point;
   public velocity: Vector | null;
   public acceleration: Vector | null;
   public rotation: number;
   public angularVelocity: number;
   public readonly angularAcceleration: number;
   public readonly angularDrag: number;
   public readonly opacity: number | ((age: number) => number);
   public readonly scale: number | ((age: number) => number);
   public readonly drag: number;
   public readonly lifetime: number;

   private chunk: Chunk;

   private _age = 0;

   constructor(info: ParticleInfo) {
      this.id = getAvailableID();

      this.type = info.type;
      
      this.position = info.spawnPosition;
      this.velocity = info.initialVelocity;
      this.acceleration = info.initialAcceleration;
      this.rotation = info.initialRotation;
      this.angularVelocity = typeof info.angularVelocity !== "undefined" ? info.angularVelocity : 0;
      this.angularAcceleration = typeof info.angularAcceleration !== "undefined" ? info.angularAcceleration : 0;
      this.angularDrag = typeof info.angularDrag !== "undefined" ? info.angularDrag : 0;
      this.opacity = info.opacity;
      this.scale = typeof info.scale !== "undefined" ? info.scale : 1;
      this.drag = typeof info.drag !== "undefined" ? info.drag : 0;
      this.lifetime = info.lifetime;

      this.chunk = this.calculateContainingChunk();
      this.chunk.addParticle(this);

      Board.addParticle(this);
   }

   private a(): void {
      this.rotation += this.angularVelocity / SETTINGS.TPS;

      // Angular acceleration
      this.angularVelocity += this.angularAcceleration / SETTINGS.TPS;
      
      // Angular drag
      // Move the angular velocity to zero
      if (this.angularVelocity !== 0) {
         const signBefore = Math.sign(this.angularVelocity);
         this.angularVelocity -= this.angularDrag * signBefore / SETTINGS.TPS;
         if (Math.sign(this.angularVelocity) !== signBefore) {
            this.angularVelocity = 0;
         }
      }
   }

   private b(): void {
      // TODO: Find better way than this shittiness
      if (this.position.x < 0 || this.position.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE || this.position.y < 0 || this.position.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE) return;
      
      const newChunk = this.calculateContainingChunk();

      // If the particle has changed chunks, add it to the new one and remove it from the old one
      if (newChunk !== this.chunk) {
         this.chunk.removeParticle(this);
         newChunk.addParticle(this);
         this.chunk = newChunk;
      }
   }

   public tick(): void {
      this.applyPhysics();
      this.a();
      this.b();

      // this.rotation += this.angularVelocity / SETTINGS.TPS;

      // // Angular acceleration
      // this.angularVelocity += this.angularAcceleration / SETTINGS.TPS;
      
      // // Angular drag
      // // Move the angular velocity to zero
      // if (this.angularVelocity !== 0) {
      //    const signBefore = Math.sign(this.angularVelocity);
      //    this.angularVelocity -= this.angularDrag * signBefore / SETTINGS.TPS;
      //    if (Math.sign(this.angularVelocity) !== signBefore) {
      //       this.angularVelocity = 0;
      //    }
      // }

      // // TODO: Find better way than this shittiness
      // if (this.position.x < 0 || this.position.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE || this.position.y < 0 || this.position.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE) return;
      
      // const newChunk = this.calculateContainingChunk();

      // // If the particle has changed chunks, add it to the new one and remove it from the old one
      // if (newChunk !== this.chunk) {
      //    this.chunk.removeParticle(this);
      //    newChunk.addParticle(this);
      //    this.chunk = newChunk;
      // }
   }

   private applyPhysics(): void {
      // Accelerate
      if (this.acceleration !== null) {
         const acceleration = this.acceleration.copy();
         acceleration.magnitude *= 1 / SETTINGS.TPS;

         // Add acceleration to velocity
         if (this.velocity !== null) {
            this.velocity.add(acceleration);
         } else {
            this.velocity = acceleration;
         }
      }

      // Drag
      if (this.velocity !== null) {
         this.velocity.magnitude -= this.drag / SETTINGS.TPS;
         if (this.velocity.magnitude < 0) {
            this.velocity = null;
         }
      }
      
      // Apply velocity
      if (this.velocity !== null) {
         const velocity = this.velocity.copy();
         velocity.magnitude /= SETTINGS.TPS;
         this.position.add(velocity.convertToPoint());
      }
   }

   public age(): void {
      this._age += 1 / SETTINGS.TPS;
   }

   public getAge(): number {
      return this._age;
   }

   private calculateContainingChunk(): Chunk {
      const chunkX = Math.floor(this.position.x / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);
      const chunkY = Math.floor(this.position.y / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);
      return Board.getChunk(chunkX, chunkY);
   }

   public getChunk(): Chunk {
      return this.chunk;
   }
}

export default Particle;