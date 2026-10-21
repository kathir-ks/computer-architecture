import { describe, expect, it, vi } from 'vitest';
import { ViewState } from '../../src/scene/view/viewState';

describe('ViewState', () => {
  it('starts cinematic, high quality, nothing toggled', () => {
    expect(new ViewState().get()).toEqual({
      cameraMode: 'cinematic',
      workerView: false,
      handedBack: false,
      xray: false,
      quality: 'high',
    });
  });

  it('accepts initial overrides', () => {
    const v = new ViewState({ cameraMode: 'free', quality: 'low', xray: true });
    expect(v.get()).toMatchObject({ cameraMode: 'free', quality: 'low', xray: true });
  });

  it('userGrab hands the camera back; resume clears it', () => {
    const v = new ViewState();
    v.userGrab();
    expect(v.get().handedBack).toBe(true);
    v.resume();
    expect(v.get().handedBack).toBe(false);
  });

  it('choosing a camera mode clears hand-back', () => {
    const v = new ViewState();
    v.userGrab();
    v.setCameraMode('follow');
    expect(v.get()).toMatchObject({ cameraMode: 'follow', handedBack: false });
  });

  it('Worker view restores the previous mode on exit', () => {
    const v = new ViewState({ cameraMode: 'follow' });
    v.enterWorkerView();
    expect(v.get().workerView).toBe(true);
    v.exitWorkerView();
    expect(v.get()).toMatchObject({ workerView: false, cameraMode: 'follow' });
  });

  it('a mode picked during Worker view applies on exit', () => {
    const v = new ViewState({ cameraMode: 'follow' });
    v.enterWorkerView();
    v.setCameraMode('free');
    v.exitWorkerView();
    expect(v.get().cameraMode).toBe('free');
  });

  it('entering Worker view clears hand-back; grabs inside it are not hand-backs', () => {
    const v = new ViewState();
    v.userGrab();
    v.enterWorkerView();
    expect(v.get().handedBack).toBe(false);
    v.userGrab();
    expect(v.get().handedBack).toBe(false);
  });

  it('leaving Worker view restores a hand-back the learner had before entering', () => {
    const v = new ViewState();
    v.userGrab();
    v.enterWorkerView();
    v.exitWorkerView();
    expect(v.get().handedBack).toBe(true);

    const w = new ViewState();
    w.enterWorkerView();
    w.exitWorkerView();
    expect(w.get().handedBack).toBe(false);
  });

  it('picking a mode while seated re-engages the automation on exit', () => {
    const v = new ViewState();
    v.userGrab();
    v.enterWorkerView();
    v.setCameraMode('follow');
    v.exitWorkerView();
    expect(v.get()).toMatchObject({ cameraMode: 'follow', handedBack: false });
  });

  it('X-ray is independent of camera and Worker view', () => {
    const v = new ViewState();
    v.setXray(true);
    v.enterWorkerView();
    v.setCameraMode('free');
    v.exitWorkerView();
    expect(v.get().xray).toBe(true);
  });

  it('quality steps down high → medium → low and never up on its own', () => {
    const v = new ViewState();
    expect(v.stepDownQuality()).toBe(true);
    expect(v.get().quality).toBe('medium');
    expect(v.stepDownQuality()).toBe(true);
    expect(v.get().quality).toBe('low');
    expect(v.stepDownQuality()).toBe(false);
    expect(v.get().quality).toBe('low');
  });

  it('manual quality can go back up', () => {
    const v = new ViewState({ quality: 'low' });
    v.setQuality('high');
    expect(v.get().quality).toBe('high');
  });

  it('notifies once per real change and not for no-ops; unsubscribe works', () => {
    const v = new ViewState();
    const cb = vi.fn();
    const off = v.subscribe(cb);
    v.setXray(true);
    v.setXray(true); // no-op
    v.setCameraMode('cinematic'); // already cinematic: no-op
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    v.setXray(false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('get() returns a copy', () => {
    const v = new ViewState();
    const s = v.get();
    s.xray = true;
    expect(v.get().xray).toBe(false);
  });
});
