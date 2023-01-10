//import React from "react";
// import { grpc } from "@improbable-eng/grpc-web";
import { Buffer } from "buffer";
//import grpc from "@grpc/grpc-js";
//import { conditionalExpression } from "@babel/types";
//import generate from "@babel/generator";
//require("dotenv").config();

var grpc = require("@improbable-eng/grpc-web");
//var Buffer = require("buffer");
var GenerationService = require("./generation/generation_pb_service");
var Generation = require("./generation/generation_pb");

// const GenerationService = require("./generation/generation_pb_service");
// const Generation = require("./generation/generation_pb");
// const grpc = require("@improbable-eng/grpc-web");
// const Buffer = require("buffer");

async function generate(inputText) {
  // Set up image parameters
  const imageParams = new Generation.ImageParameters();
  imageParams.setWidth(512);
  imageParams.setHeight(512);
  imageParams.addSeed(1234);
  imageParams.setSamples(1);
  imageParams.setSteps(50);

  // Use the `k-dpmpp-2` sampler
  const transformType = new Generation.TransformType();
  transformType.setDiffusion(Generation.DiffusionSampler.SAMPLER_K_DPMPP_2M);
  imageParams.setTransform(transformType);

  // Use Stable Diffusion 2.0
  const request = new Generation.Request();
  request.setEngineId("stable-diffusion-512-v2-1");
  request.setRequestedType(Generation.ArtifactType.ARTIFACT_IMAGE);
  request.setClassifier(new Generation.ClassifierParameters());

  // Use a CFG scale of `13`
  const samplerParams = new Generation.SamplerParameters();
  samplerParams.setCfgScale(13);

  const stepParams = new Generation.StepParameter();
  const scheduleParameters = new Generation.ScheduleParameters();

  // Set the schedule to `0`, this changes when doing an initial image generation
  stepParams.setScaledStep(0);
  stepParams.setSampler(samplerParams);
  stepParams.setSchedule(scheduleParameters);

  imageParams.addParameters(stepParams);
  request.setImage(imageParams);

  // Set our text prompt
  const promptText = new Generation.Prompt();
  promptText.setText(inputText);

  request.addPrompt(promptText);

  //console.log(inputText);

  // Authenticate using your API key, don't commit your key to a public repository!
  const metadata = new grpc.Metadata();
  metadata.set("Authorization", "Bearer " + process.env.REACT_APP_API_KEY);

  // Create a generation client
  const generationClient = new GenerationService.GenerationServiceClient(
    "https://grpc.stability.ai",
    {}
  );

  // Send the request using the `metadata` with our key from earlier
  const generation = generationClient.generate(request, metadata);

  // Set up a callback to handle data being returned :

  var imagesrc = "";

  generation.on("data", (data) => {
    data.getArtifactsList().forEach((artifact) => {
      // Oh no! We were filtered by the NSFW classifier!
      if (
        artifact.getType() === Generation.ArtifactType.ARTIFACT_TEXT &&
        artifact.getFinishReason() === Generation.FinishReason.FILTER
      ) {
        return { status: -1, imgsrc: null };
      }

      // Make sure we have an image
      if (artifact.getType() !== Generation.ArtifactType.ARTIFACT_IMAGE)
        return { status: -1, imgsrc: null };

      // You can convert the raw binary into a base64 string

      //バイナリをbase64画像に変換
      const buf = Buffer.from(artifact.getBinary());
      const base64Image = buf.toString("base64");

      // Here's how you get the seed back if you set it to `0` (random)
      const seed = artifact.getSeed();

      // We're done!
      imagesrc = `data:image/png;base64,${base64Image}`;
    });
  });

  // Anything other than `status.code === 0` is an error
  generation.on("status", (status) => {
    //console.log(status);
    if (status.code === 0) {
      return { status: 0, imgsrc: imagesrc };
    }
    return { status: -1, imgsrc: null };
  });

  return { status: -1, imgsrc: null };
}

export default async function (request, response) {
  const { prompt = "World" } = request.query;
  return response.end(generate(prompt));
}
