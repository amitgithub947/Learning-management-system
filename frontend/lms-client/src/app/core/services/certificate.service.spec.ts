import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { CertificateService } from './certificate.service';
describe('CertificateService', () => {
  it('downloads a PDF through HttpClient so the auth interceptor can protect it', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const promise = firstValueFrom(TestBed.inject(CertificateService).download('certificate'));
    const req = http.expectOne('/api/certificates/certificate/download');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF-test'], { type: 'application/pdf' }));
    expect((await promise).type).toBe('application/pdf');
    http.verify();
  });
});
