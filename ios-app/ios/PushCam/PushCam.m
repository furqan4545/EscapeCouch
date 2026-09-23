// React Native side of PushCam: events and methods for the game, plus the camera preview view.
// The work happens in PushCamEngine.swift.

#import <React/RCTEventEmitter.h>
#import <React/RCTUtils.h>
#import <React/RCTViewManager.h>
#import "PushCam-Swift.h"

@interface PushCam : RCTEventEmitter <RCTBridgeModule>
@end

@implementation PushCam {
  BOOL _listening;
}

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"pose", @"error" ];
}

- (void)startObserving
{
  _listening = YES;
}

- (void)stopObserving
{
  _listening = NO;
}

RCT_EXPORT_METHOD(start)
{
  __weak PushCam *weakSelf = self;
  PushCamEngine *engine = PushCamEngine.shared;
  engine.onPose = ^(NSDictionary<NSString *, id> *body) {
    PushCam *me = weakSelf;
    if (me && me->_listening) {
      [me sendEventWithName:@"pose" body:body];
    }
  };
  engine.onError = ^(NSString *message) {
    PushCam *me = weakSelf;
    if (me && me->_listening) {
      [me sendEventWithName:@"error" body:@{@"message" : message}];
    }
  };
  [engine start];
}

RCT_EXPORT_METHOD(play : (NSString *)name)
{
  [PushCamEngine.shared play:name];
}

static void settle(NSString *error, RCTPromiseResolveBlock resolve, RCTPromiseRejectBlock reject)
{
  if (error) {
    reject(@"pushcam", error, nil);
  } else {
    resolve(nil);
  }
}

RCT_EXPORT_METHOD(startRecording : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  [PushCamEngine.shared startRecording:^(NSString *error) { settle(error, resolve, reject); }];
}

RCT_EXPORT_METHOD(stopRecording : (double)trimSec resolver : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  [PushCamEngine.shared stopRecording:trimSec done:^(NSString *error) { settle(error, resolve, reject); }];
}

RCT_EXPORT_METHOD(saveRecording : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  [PushCamEngine.shared saveRecording:^(NSString *error) { settle(error, resolve, reject); }];
}

RCT_EXPORT_METHOD(shareRecording : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [PushCamEngine.shared shareRecordingFrom:RCTPresentedViewController()
                                        done:^(NSString *error) { settle(error, resolve, reject); }];
  });
}

RCT_EXPORT_METHOD(loadProfile : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  resolve([PushCamEngine.shared loadProfile]);
}

RCT_EXPORT_METHOD(saveProfile : (NSString *)json)
{
  [PushCamEngine.shared saveProfile:json];
}

RCT_EXPORT_METHOD(pickPhoto : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [PushCamEngine.shared pickPhotoFrom:RCTPresentedViewController()
                                   done:^(NSString *file, NSString *error) {
                                     if (error) {
                                       reject(@"pushcam", error, nil);
                                     } else {
                                       resolve(file ?: (id)[NSNull null]);
                                     }
                                   }];
  });
}

@end

@interface PushCamViewManager : RCTViewManager
@end

@implementation PushCamViewManager

RCT_EXPORT_MODULE(PushCamView)

- (UIView *)view
{
  return [PushCamPreview new];
}

@end
