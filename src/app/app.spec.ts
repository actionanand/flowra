import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { App } from './app';
import { AppStore } from './core/services/app-store.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: AppStore,
          useValue: {
            initialize: async () => undefined,
            ready: signal(true),
            profiles: signal([]),
            activeProfileId: signal(''),
            settings: signal({ pinEnabled: false, lockWhenBackgrounded: true }),
            selectProfile: () => undefined,
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the Flowra brand', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Flowra');
  });
});
