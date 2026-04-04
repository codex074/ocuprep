import Swal from 'sweetalert2';

export function openLoadingModal(title: string, text = 'กรุณารอสักครู่') {
  Swal.fire({
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });
}

export function closeLoadingModal() {
  Swal.close();
}
