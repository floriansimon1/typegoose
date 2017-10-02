import 'reflect-metadata';
import * as mongoose from 'mongoose';
import * as _ from 'lodash';

import { schema, models, methods, virtuals, hooks, plugins } from './data';

export * from './method';
export * from './prop';
export * from './hooks';
export * from './plugin';

export type InstanceType<T> = T & mongoose.Document;
export type ModelType<T> = mongoose.Model<InstanceType<T>> & T;

export interface GetModelForClassOptions {
  existingMongoose?: mongoose.Mongoose; // TODO deprecated
  schemaOptions?: mongoose.SchemaOptions;
  existingConnection?: mongoose.Connection;
}

export class Typegoose {
  getModelForClass<T>(t: T, { existingMongoose, schemaOptions, existingConnection }: GetModelForClassOptions = {}) {
    const name = (this.constructor as any).name;
    if (!models[name]) {
      const Schema = mongoose.Schema;

      const sch = schemaOptions ?
        new Schema(schema[name], schemaOptions) :
        new Schema(schema[name]);

      const staticMethods = methods.staticMethods[name];
      sch.statics = staticMethods;

      const instanceMethods = methods.instanceMethods[name];
      sch.methods = instanceMethods || {};

      if (hooks[name]) {
        const preHooks = hooks[name].pre;
        preHooks.forEach((preHookArgs) => {
          (sch as any).pre(...preHookArgs);
        });
        const postHooks = hooks[name].post;
        postHooks.forEach((postHookArgs) => {
          (sch as any).post(...postHookArgs);
        });
      }

      if (plugins[name]) {
        _.forEach(plugins[name], (plugin) => {
          sch.plugin(plugin.mongoosePlugin, plugin.options);
        });
      }

      const getterSetters = virtuals[name];
      _.forEach(getterSetters, (value, key) => {
        if (value.get) {
          sch.virtual(key).get(value.get);
        }
        if (value.set) {
          sch.virtual(key).set(value.set);
        }
      });

      const model = existingConnection ?
        existingConnection.model.bind(existingConnection) :
        mongoose.model.bind(mongoose);

      models[name] = model(name, sch);
    }

    return models[name] as ModelType<this> & T;
  }
}
