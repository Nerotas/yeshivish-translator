"""
Custom middleware for the yeshivish-translator backend.
"""


class DisableClientSideCompressionMiddleware:
    """
    Removes Accept-Encoding from CORS requests to prevent compression issues
    with the browser fetch API when responses are gzip-encoded but can't be
    properly decompressed.

    This is a development workaround for a known issue where django-cors-headers
    and compression middleware interact poorly with browser fetch requests.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Remove Accept-Encoding for API requests to prevent compression
        # issues with CORS responses in the browser fetch API
        if request.path.startswith("/api/"):
            if "HTTP_ACCEPT_ENCODING" in request.META:
                del request.META["HTTP_ACCEPT_ENCODING"]

        response = self.get_response(request)
        return response
