FROM ubuntu:22.04
RUN apt-get update && apt-get install -y python3-pip nodejs npm && cpan install JSON
RUN useradd -ms /bin/bash runuser
USER runuser
WORKDIR /app
CMD ["bash"]
