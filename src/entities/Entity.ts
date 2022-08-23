import Chunk from "../Chunk";
import { EntityType, lerp, Point, SETTINGS, Tile, TILE_TYPE_INFO_RECORD, Vector } from "webgl-test-shared";
import Component from "../entity-components/Component";
import { SERVER } from "../server";

let idCounter = 0;

/** Finds a unique available ID for an entity */
const findAvailableID = (): number => {
   return idCounter++;
}

abstract class Entity {
   private readonly components = new Map<(abstract new (...args: any[]) => any), Component>();

   /** Unique identifier for every entity */
   public readonly id: number = findAvailableID();
   /** Type of the entity (e.g. "cow") */
   public abstract readonly type: EntityType;

   /** Position of the entity */
   public position: Point;
   /** Velocity of the entity */
   public velocity: Vector | null = null;
   /** Acceleration of the entity */
   public acceleration: Vector | null = null;

   /** Limit to how many units the entity can move in a second */
   public terminalVelocity: number = 0;

   public previousChunk: Chunk;

   public isRemoved: boolean = false;

   public isMoving: boolean = true;

   constructor(position: Point, velocity: Vector | null, acceleration: Vector | null, components: Array<Component>) {
      this.position = position;
      this.velocity = velocity;
      this.acceleration = acceleration;

      this.previousChunk = this.findContainingChunk();

      for (const component of components) {
         this.components.set(component.constructor as (new (...args: any[]) => any), component);

         component.setEntity(this);
      }
   }

   public onLoad?(): void;

   public loadComponents(): void {
      this.components.forEach(component => {
         if (typeof component.onLoad !== "undefined") component.onLoad();
      });
   }

   public tick(): void {
      this.applyPhysics();

      this.components.forEach(component => {
         if (typeof component.tick !== "undefined") {
            component.tick();
         }
      });
   }

   private applyPhysics(): void {
      const tile = this.findCurrentTile();
      const tileTypeInfo = TILE_TYPE_INFO_RECORD[tile.type];

      // Apply acceleration
      if (this.acceleration !== null) {
         const acceleration = this.acceleration.copy();
         acceleration.magnitude /= SETTINGS.TPS;

         // Apply friction to acceleration
         const REDUCTION_FACTOR = 0.3;
         acceleration.magnitude *= lerp(REDUCTION_FACTOR, 1, tileTypeInfo.friction);

         // Add acceleration to velocity
         if (this.velocity === null) {
            this.velocity = acceleration;
         } else {
            this.velocity = this.velocity.add(acceleration);
         }
      }
      else if (!this.isMoving && this.velocity !== null) {
         // Apply friction
         this.velocity.magnitude -= this.terminalVelocity * tileTypeInfo.friction * SETTINGS.FRICTION_CONSTANT / SETTINGS.TPS;
         if (this.velocity.magnitude < 0) this.velocity = null;
      }

      // Terminal velocity
      if (this.velocity !== null && this.velocity.magnitude > this.terminalVelocity) {
         this.velocity.magnitude = this.terminalVelocity;
      }

      // Apply velocity
      if (this.velocity !== null) {
         const velocity = this.velocity.copy();
         velocity.magnitude /= SETTINGS.TPS;
          
         // // Apply tile slowness to velocity
         if (typeof tileTypeInfo.effects?.moveSpeedMultiplier !== "undefined") {
            velocity.magnitude *= tileTypeInfo.effects.moveSpeedMultiplier;
         }
         
         this.position = this.position.add(velocity.convertToPoint());
      }
   }

   private findCurrentTile(): Tile {
      const tileX = Math.floor(this.position.x / SETTINGS.TILE_SIZE);
      const tileY = Math.floor(this.position.y / SETTINGS.TILE_SIZE);
      return SERVER.board.tiles[tileX][tileY];
   }

   public getComponent<C extends Component>(constr: { new(...args: any[]): C }): C | null {
      const component = this.components.get(constr);
      return typeof component !== "undefined" ? (component as C) : null;
   }

   public findContainingChunk(): Chunk {
      const chunkX = Math.floor(this.position.x / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);
      const chunkY = Math.floor(this.position.y / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);

      return SERVER.board.chunks[chunkX][chunkY];
   }
}

export default Entity;